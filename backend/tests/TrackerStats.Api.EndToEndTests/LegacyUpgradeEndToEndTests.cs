using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Shouldly;
using Testcontainers.PostgreSql;
using TrackerStats.Domain.Entities;
using TrackerStats.Infrastructure.Data;
using TrackerStats.Infrastructure.Plugins.Storage;

namespace TrackerStats.Api.EndToEndTests;

public sealed class LegacyUpgradeEndToEndTests : IAsyncLifetime
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private const string V03Migration = "20260406043447_Initial";
    private const string Payload = """{"baseUrl":"https://seedpool.org/","apiKey":"legacy-api-key","cron":"0 0 1 1 *"}""";

    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:17-alpine")
        .WithDatabase("trackerstats")
        .WithUsername("postgres")
        .WithPassword("postgres")
        .Build();

    private readonly string _dataDirectory = Path.Combine(Path.GetTempPath(), $"trackerstats-upgrade-{Guid.NewGuid():N}");

    public async Task InitializeAsync()
    {
        Directory.CreateDirectory(_dataDirectory);
        await _postgres.StartAsync();
    }

    public async Task DisposeAsync()
    {
        await _postgres.DisposeAsync();
        if (Directory.Exists(_dataDirectory))
            Directory.Delete(_dataDirectory, recursive: true);
    }

    [Fact]
    public async Task First_boot_should_delete_legacy_yaml_and_keep_integrations_and_snapshots()
    {
        var (official, custom) = await SeedV03DatabaseAsync();
        var legacyFiles = new[]
        {
            WriteDataFile("seedpool.yaml"),
            WriteDataFile("my-tracker.yaml"),
            WriteDataFile(Path.Combine("templates", "asc.yaml")),
            WriteDataFile(Path.Combine("templates", "my-tracker.yaml"))
        };
        var keptFile = WriteDataFile("notes.txt");
        RepoPlugins.CopyToOfficial(_dataDirectory);
        var before = await ReadDatabaseAsync();

        await BootAsync(async client =>
        {
            var integrations = await client.GetFromJsonAsync<List<IntegrationResponse>>("/api/integrations", JsonOptions);
            integrations.ShouldNotBeNull();
            integrations.Select(integration => integration.Id).ShouldBe([official, custom], ignoreOrder: true);

            var snapshots = await client.GetFromJsonAsync<SnapshotsResponse>($"/api/snapshots?integrationId={official}&range=24h", JsonOptions);
            snapshots.ShouldNotBeNull();
            snapshots.Items.Count.ShouldBe(2);

            var whatsNew = await client.GetFromJsonAsync<JsonElement>("/api/whats-new", JsonOptions);
            whatsNew.GetProperty("lastReadAt").ValueKind.ShouldBe(JsonValueKind.Null);
            (await client.PostAsync("/api/whats-new/read", null)).StatusCode.ShouldBe(System.Net.HttpStatusCode.NoContent);
        });

        foreach (var path in legacyFiles)
            File.Exists(path).ShouldBeFalse(path);
        File.Exists(keptFile).ShouldBeTrue();
        new PluginStateStore(PluginStorageLayout.ForDataDirectory(_dataDirectory)).Load()
            .LegacyCleanupCompletedAt.ShouldNotBeNull();
        (await ReadDatabaseAsync()).ShouldBe(before);
        await using (var db = CreateDbContext())
            (await db.WhatsNewStates.SingleAsync()).LastReadAt.ShouldNotBeNull();

        var secondBootFile = WriteDataFile(Path.Combine("templates", "added-after-upgrade.yaml"));
        await BootAsync(_ => Task.CompletedTask);

        File.Exists(secondBootFile).ShouldBeTrue();
        (await ReadDatabaseAsync()).ShouldBe(before);
    }

    private async Task<(Guid Official, Guid Custom)> SeedV03DatabaseAsync()
    {
        await using var db = CreateDbContext();
        await db.GetService<IMigrator>().MigrateAsync(V03Migration);

        var official = new Integration { Id = Guid.NewGuid(), PluginId = "seedpool", Payload = Payload, Ratio = 1.25m, RequiredRatio = 1.5m };
        var custom = new Integration { Id = Guid.NewGuid(), PluginId = "my-tracker", Payload = Payload, Ratio = 3m };
        db.Integrations.AddRange(official, custom);
        foreach (var (integration, hoursAgo) in new[] { (official, 2), (official, 1), (custom, 1) })
        {
            db.IntegrationSnapshots.Add(new IntegrationSnapshot
            {
                Id = Guid.NewGuid(),
                IntegrationId = integration.Id,
                CapturedAt = DateTime.UtcNow.AddHours(-hoursAgo),
                Ratio = integration.Ratio,
                UploadedBytes = 1024L * hoursAgo
            });
        }

        await db.SaveChangesAsync();
        return (official.Id, custom.Id);
    }

    private async Task<string> ReadDatabaseAsync()
    {
        await using var db = CreateDbContext();
        var integrations = await db.Integrations.AsNoTracking().OrderBy(i => i.Id).ToListAsync();
        var snapshots = await db.IntegrationSnapshots.AsNoTracking().OrderBy(s => s.Id).ToListAsync();
        return JsonSerializer.Serialize(new { integrations, snapshots });
    }

    private AppDbContext CreateDbContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(_postgres.GetConnectionString()).Options);

    private async Task BootAsync(Func<HttpClient, Task> act)
    {
        var variables = new Dictionary<string, string>
        {
            ["ConnectionStrings__PostgresConnection"] = _postgres.GetConnectionString(),
            ["ConnectionStrings__HangfireConnection"] = $"Data Source={Path.Combine(_dataDirectory, "hangfire-upgrade.db")}",
            ["Data__Directory"] = _dataDirectory,
            [RepoPlugins.SourceUrlEnvVar] = RepoPlugins.OfflineSourceUrl(_dataDirectory),
            [RepoPlugins.AppReleasesUrlEnvVar] = RepoPlugins.OfflineAppReleasesUrl
        };
        foreach (var (name, value) in variables)
            Environment.SetEnvironmentVariable(name, value);

        try
        {
            await using var factory = new UpgradeBootFactory();
            using var client = factory.CreateClient();
            await act(client);
        }
        finally
        {
            foreach (var name in variables.Keys)
                Environment.SetEnvironmentVariable(name, null);
        }
    }

    private string WriteDataFile(string relativePath)
    {
        var path = Path.Combine(_dataDirectory, relativePath);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, "pluginId: legacy\ndisplayName: Legacy\n");
        return path;
    }

    private sealed class UpgradeBootFactory : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder) => builder.UseEnvironment("Development");
    }

    private sealed class IntegrationResponse
    {
        public Guid Id { get; init; }
    }

    private sealed class SnapshotsResponse
    {
        public List<JsonElement> Items { get; init; } = [];
    }
}
