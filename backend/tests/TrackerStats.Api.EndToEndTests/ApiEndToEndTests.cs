using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Shouldly;
using Testcontainers.PostgreSql;
using TrackerStats.Domain.Entities;
using TrackerStats.Infrastructure.Data;

namespace TrackerStats.Api.EndToEndTests;

[Trait("Database", "Sqlite")]
public sealed class SqliteApiEndToEndTests(SqliteApiEndToEndFactory factory)
    : ApiEndToEndTests(factory), IClassFixture<SqliteApiEndToEndFactory>;

[Trait("Database", "Postgres")]
public sealed class PostgresApiEndToEndTests(PostgresApiEndToEndFactory factory)
    : ApiEndToEndTests(factory), IClassFixture<PostgresApiEndToEndFactory>;

public abstract class ApiEndToEndTests(ApiEndToEndFactory factory)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [Fact]
    public async Task Get_plugins_should_load_definitions_from_disk()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/plugins");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var plugins = await response.Content.ReadFromJsonAsync<List<PluginResponse>>(JsonOptions);
        plugins.ShouldNotBeNull();
        plugins.ShouldContain(plugin => plugin.PluginId == "seedpool" && plugin.DefinitionValid);
        plugins.ShouldContain(plugin => plugin.PluginId == "asc");
    }

    [Fact]
    public async Task Create_and_list_integrations_should_persist()
    {
        using var client = factory.CreateClient();
        var payload = JsonSerializer.Serialize(new Dictionary<string, string>
        {
            ["baseUrl"] = "https://seedpool.org/",
            ["apiKey"] = "integration-api-key",
            ["required_ratio"] = "1.50",
            ["cron"] = "0 * * * *"
        });

        var createResponse = await client.PostAsJsonAsync("/api/integrations", new
        {
            pluginId = "seedpool",
            payload
        });

        createResponse.StatusCode.ShouldBe(HttpStatusCode.Created);
        var created = await createResponse.Content.ReadFromJsonAsync<IntegrationResponse>(JsonOptions);
        created.ShouldNotBeNull();
        created.PluginId.ShouldBe("seedpool");
        created.RequiredRatio.ShouldBe(1.5m);
        created.Payload.ShouldContainKey("baseUrl");
        created.Payload.ShouldNotContainKey("apiKey");

        var listResponse = await client.GetAsync("/api/integrations");

        listResponse.StatusCode.ShouldBe(HttpStatusCode.OK);
        var integrations = await listResponse.Content.ReadFromJsonAsync<List<IntegrationResponse>>(JsonOptions);
        integrations.ShouldNotBeNull();
        var persisted = integrations.FirstOrDefault(integration => integration.Id == created.Id);
        persisted.ShouldNotBeNull();
        persisted.Payload["baseUrl"].ShouldBe("https://seedpool.org/");
        persisted.Payload.ShouldNotContainKey("apiKey");
        persisted.ConfigurationValid.ShouldBeTrue();
    }

    [Fact]
    public async Task Whats_new_should_store_its_read_state_in_a_fresh_database()
    {
        using var client = factory.CreateClient();

        var before = await client.GetFromJsonAsync<JsonElement>("/api/whats-new", JsonOptions);

        before.GetProperty("lastReadAt").ValueKind.ShouldBe(JsonValueKind.Null);
        before.GetProperty("lastReadPluginChangeId").ValueKind.ShouldBe(JsonValueKind.Null);
        before.GetProperty("app").GetProperty("status").GetString().ShouldBe("unavailable");
        before.GetProperty("pluginUpdates").GetArrayLength().ShouldBe(0);

        (await client.PostAsync("/api/whats-new/read", null)).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var after = await client.GetFromJsonAsync<JsonElement>("/api/whats-new", JsonOptions);
        after.GetProperty("shouldAutoOpen").GetBoolean().ShouldBeFalse();
        after.GetProperty("lastReadAt").ValueKind.ShouldBe(JsonValueKind.String);
        after.GetProperty("lastReadPluginChangeId").GetInt64().ShouldBe(0);
    }

    [Fact]
    public async Task Startup_should_log_the_engine_version_and_never_the_password()
    {
        using var client = factory.CreateClient();

        factory.Logs.Messages.ShouldContain(message => message.StartsWith($"Database: {factory.EngineName} {factory.EngineMajorVersion}."));
        factory.Logs.Messages.ShouldNotContain(message => message.Contains(PostgresApiEndToEndFactory.PostgresPassword));
        var about = await client.GetFromJsonAsync<JsonElement>("/api/about", JsonOptions);
        about.GetProperty("databaseEngine").GetString().ShouldBe(factory.EngineName);
    }

    [Fact]
    public async Task Snapshot_ranges_should_filter_inclusively_and_order_by_captured_at_in_utc()
    {
        var start = new DateTime(2026, 3, 1, 12, 0, 0, DateTimeKind.Utc);
        var end = start.AddHours(2);
        var integrationId = Guid.NewGuid();
        var otherIntegrationId = Guid.NewGuid();
        var inRange = new[]
        {
            Snapshot(integrationId, start, 1.000001m),
            Snapshot(integrationId, start.AddMinutes(30).ToLocalTime(), 1.25m),
            Snapshot(integrationId, start.AddHours(1).AddMilliseconds(500), 1.5m),
            Snapshot(integrationId, end, 2m)
        };
        var outOfRange = new[]
        {
            Snapshot(integrationId, start.AddMilliseconds(-1), 0.5m),
            Snapshot(integrationId, end.AddMilliseconds(1), 3m),
            Snapshot(otherIntegrationId, start.AddHours(1), 9m)
        };

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            foreach (var id in new[] { integrationId, otherIntegrationId })
                db.Integrations.Add(new Integration { Id = id, PluginId = "seedpool", Payload = "{}" });
            // Inserted out of order, so only the query's ORDER BY can sort them.
            db.IntegrationSnapshots.AddRange(outOfRange.Concat(inRange.Reverse()));
            await db.SaveChangesAsync();
        }

        using var client = factory.CreateClient();
        // The same instants as start and end, with "from" given at a +02:00 offset.
        var response = await client.GetFromJsonAsync<JsonElement>(
            $"/api/snapshots?integrationId={integrationId}&from=2026-03-01T14:00:00%2B02:00&to=2026-03-01T14:00:00Z",
            JsonOptions);

        response.GetProperty("range").GetString().ShouldBe("custom");
        response.GetProperty("from").GetDateTime().ShouldBe(start);
        response.GetProperty("to").GetDateTime().ShouldBe(end);
        var items = response.GetProperty("items").EnumerateArray().ToList();
        items.Select(item => item.GetProperty("id").GetGuid()).ShouldBe(inRange.Select(snapshot => snapshot.Id));
        items.Select(item => item.GetProperty("capturedAt").GetString()!).ShouldAllBe(value => value.EndsWith('Z'));
        items.Select(item => item.GetProperty("capturedAt").GetDateTime())
            .ShouldBe(inRange.Select(snapshot => snapshot.CapturedAt.ToUniversalTime()));
        items.Select(item => item.GetProperty("ratio").GetDecimal()).ShouldBe(inRange.Select(snapshot => snapshot.Ratio!.Value));
    }

    private static IntegrationSnapshot Snapshot(Guid integrationId, DateTime capturedAt, decimal ratio) => new()
    {
        Id = Guid.NewGuid(),
        IntegrationId = integrationId,
        CapturedAt = capturedAt,
        Ratio = ratio
    };

    public sealed class PluginResponse
    {
        public string PluginId { get; init; } = string.Empty;
        public bool DefinitionValid { get; init; }
    }

    public sealed class IntegrationResponse
    {
        public Guid Id { get; init; }
        public string PluginId { get; init; } = string.Empty;
        public decimal? RequiredRatio { get; init; }
        public bool ConfigurationValid { get; init; }
        public Dictionary<string, string?> Payload { get; init; } = [];
    }
}

public abstract class ApiEndToEndFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly string _dataDirectory = Path.Combine(Path.GetTempPath(), $"trackerstats-e2e-{Guid.NewGuid():N}");
    private Dictionary<string, string?> _variables = [];

    internal LogCollector Logs { get; } = new();
    internal abstract string EngineName { get; }
    internal abstract int EngineMajorVersion { get; }

    // Returns the Postgres connection string, or null to run on SQLite.
    protected abstract Task<string?> StartDatabaseAsync();
    protected abstract Task StopDatabaseAsync();

    public async Task InitializeAsync()
    {
        Directory.CreateDirectory(_dataDirectory);
        RepoPlugins.CopyToOfficial(_dataDirectory);
        _variables = TestApp.Variables(_dataDirectory, await StartDatabaseAsync());
        TestApp.Apply(_variables);
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        base.Dispose();
        TestApp.Clear(_variables.Keys);
        await StopDatabaseAsync();

        if (Directory.Exists(_dataDirectory))
            Directory.Delete(_dataDirectory, recursive: true);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureLogging(logging => logging.AddProvider(Logs));
    }
}

public sealed class SqliteApiEndToEndFactory : ApiEndToEndFactory
{
    internal override string EngineName => "SQLite";
    internal override int EngineMajorVersion => 3;

    protected override Task<string?> StartDatabaseAsync() => Task.FromResult<string?>(null);

    protected override Task StopDatabaseAsync()
    {
        SqliteConnection.ClearAllPools();
        return Task.CompletedTask;
    }
}

public sealed class PostgresApiEndToEndFactory : ApiEndToEndFactory
{
    internal const string PostgresPassword = "e2e-postgres-password";
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:17-alpine")
        .WithDatabase("trackerstats")
        .WithUsername("postgres")
        .WithPassword(PostgresPassword)
        .Build();

    internal override string EngineName => "PostgreSQL";
    internal override int EngineMajorVersion => 17;

    protected override async Task<string?> StartDatabaseAsync()
    {
        await _postgres.StartAsync();
        return _postgres.GetConnectionString();
    }

    protected override Task StopDatabaseAsync() => _postgres.DisposeAsync().AsTask();
}
