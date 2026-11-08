using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Shouldly;
using Testcontainers.PostgreSql;
using TrackerStats.Domain.Entities;
using TrackerStats.Infrastructure.Data;
using TrackerStats.Infrastructure.Plugins.Storage;

namespace TrackerStats.Api.EndToEndTests;

[Trait("Database", "Postgres")]
public sealed class LegacyUpgradeEndToEndTests : IAsyncLifetime
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private const string V03Migration = "20260406043447_Initial";
    private const string V04Migration = "20261107231750_WhatsNewState";
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

    [Fact]
    public async Task A_v04_database_should_upgrade_with_no_new_migration_and_no_data_change()
    {
        var (official, custom) = await SeedV03DatabaseAsync(V04Migration);
        var lastReadAt = new DateTime(2026, 11, 7, 23, 30, 0, DateTimeKind.Utc);
        await using (var db = CreateDbContext())
        {
            db.ApplicationSettings.Add(new ApplicationSettings { Id = 1, UserAgent = "v0.4-user-agent" });
            var whatsNew = await db.WhatsNewStates.SingleAsync();
            whatsNew.LastReadAppVersion = "0.4.0";
            whatsNew.LastReadPluginChangeId = 7;
            whatsNew.LastReadAt = lastReadAt;
            await db.SaveChangesAsync();
        }

        RepoPlugins.CopyToOfficial(_dataDirectory);
        var historyBefore = await ReadMigrationHistoryAsync();
        historyBefore.Select(row => row.Id).ShouldBe([V03Migration, V04Migration]);
        var before = await ReadAllDataAsync();

        await BootAsync(async client =>
        {
            var integrations = await client.GetFromJsonAsync<List<IntegrationResponse>>("/api/integrations", JsonOptions);
            integrations.ShouldNotBeNull();
            integrations.Select(integration => integration.Id).ShouldBe([official, custom], ignoreOrder: true);

            var snapshots = await client.GetFromJsonAsync<SnapshotsResponse>($"/api/snapshots?integrationId={official}&range=24h", JsonOptions);
            snapshots.ShouldNotBeNull();
            snapshots.Items.Count.ShouldBe(2);

            var settings = await client.GetFromJsonAsync<JsonElement>("/api/settings", JsonOptions);
            settings.GetProperty("userAgent").GetString().ShouldBe("v0.4-user-agent");

            var whatsNew = await client.GetFromJsonAsync<JsonElement>("/api/whats-new", JsonOptions);
            whatsNew.GetProperty("lastReadAt").GetDateTime().ShouldBe(lastReadAt);
        });

        (await ReadMigrationHistoryAsync()).ShouldBe(historyBefore);
        (await ReadAllDataAsync()).ShouldBe(before);
    }

    private async Task<(Guid Official, Guid Custom)> SeedV03DatabaseAsync(string targetMigration = V03Migration)
    {
        await using var db = CreateDbContext();
        await db.GetService<IMigrator>().MigrateAsync(targetMigration);

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

    private async Task<string> ReadAllDataAsync()
    {
        await using var db = CreateDbContext();
        var settings = await db.ApplicationSettings.AsNoTracking().OrderBy(s => s.Id).ToListAsync();
        var whatsNew = await db.WhatsNewStates.AsNoTracking().OrderBy(w => w.Id).ToListAsync();
        return JsonSerializer.Serialize(new { data = await ReadDatabaseAsync(), settings, whatsNew });
    }

    private async Task<List<HistoryRow>> ReadMigrationHistoryAsync()
    {
        await using var db = CreateDbContext();
        return await db.Database
            .SqlQueryRaw<HistoryRow>("""SELECT "MigrationId" AS "Id", "ProductVersion" FROM "__EFMigrationsHistory" ORDER BY "MigrationId" """)
            .ToListAsync();
    }

    private PostgresAppDbContext CreateDbContext() =>
        new(new DbContextOptionsBuilder<PostgresAppDbContext>().UseNpgsql(_postgres.GetConnectionString()).Options);

    private Task BootAsync(Func<HttpClient, Task> act) =>
        TestApp.BootAsync(_dataDirectory, _postgres.GetConnectionString(), (_, client) => act(client));

    private string WriteDataFile(string relativePath)
    {
        var path = Path.Combine(_dataDirectory, relativePath);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, "pluginId: legacy\ndisplayName: Legacy\n");
        return path;
    }

    private sealed record HistoryRow
    {
        public string Id { get; init; } = string.Empty;
        public string ProductVersion { get; init; } = string.Empty;
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
