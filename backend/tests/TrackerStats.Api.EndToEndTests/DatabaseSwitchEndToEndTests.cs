using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Shouldly;
using Testcontainers.PostgreSql;
using TrackerStats.Domain.Entities;
using TrackerStats.Infrastructure.Data;

namespace TrackerStats.Api.EndToEndTests;

[Trait("Database", "Postgres")]
public sealed class DatabaseSwitchEndToEndTests : IClassFixture<PostgresServer>, IDisposable
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly PostgresServer _server;
    private readonly string _dataDirectory = Path.Combine(Path.GetTempPath(), $"trackarr-switch-{Guid.NewGuid():N}");

    public DatabaseSwitchEndToEndTests(PostgresServer server)
    {
        _server = server;
        Directory.CreateDirectory(_dataDirectory);
        RepoPlugins.CopyToOfficial(_dataDirectory);
    }

    private string DatabasePath => Path.Combine(_dataDirectory, AppDatabase.SqliteFileName);

    public void Dispose()
    {
        SqliteConnection.ClearAllPools();
        NpgsqlConnection.ClearAllPools();
        if (Directory.Exists(_dataDirectory))
            Directory.Delete(_dataDirectory, recursive: true);
    }

    [Fact]
    public async Task Removing_postgres_should_start_an_empty_sqlite_database_and_copy_nothing()
    {
        var postgres = await _server.CreateDatabaseAsync();
        var postgresIntegration = await BootAndCreateIntegrationAsync(postgres, "PostgreSQL");
        var postgresBefore = await ReadPostgresAsync(postgres);

        await BootAsync(postgresConnection: null, async client =>
        {
            await AssertEngineAsync(client, "SQLite");
            (await ListIntegrationIdsAsync(client)).ShouldBeEmpty();
        });

        File.Exists(DatabasePath).ShouldBeTrue();
        (await ReadPostgresAsync(postgres)).ShouldBe(postgresBefore);
        postgresBefore.ShouldContain(postgresIntegration.ToString());
    }

    [Fact]
    public async Task Removing_postgres_should_open_the_old_trackarr_db_as_it_is()
    {
        var sqliteIntegration = await BootAndCreateIntegrationAsync(postgresConnection: null, "SQLite");
        SqliteConnection.ClearAllPools();
        var postgres = await _server.CreateDatabaseAsync();
        var postgresIntegration = await BootAndCreateIntegrationAsync(postgres, "PostgreSQL");
        var postgresBefore = await ReadPostgresAsync(postgres);

        await BootAsync(postgresConnection: null, async client =>
        {
            await AssertEngineAsync(client, "SQLite");
            (await ListIntegrationIdsAsync(client)).ShouldBe([sqliteIntegration]);
        });

        (await ReadPostgresAsync(postgres)).ShouldBe(postgresBefore);
        postgresBefore.ShouldContain(postgresIntegration.ToString());
        postgresBefore.ShouldNotContain(sqliteIntegration.ToString());
    }

    [Fact]
    public async Task Configuring_postgres_should_start_empty_and_leave_trackarr_db_untouched()
    {
        var sqliteIntegration = await BootAndCreateIntegrationAsync(postgresConnection: null, "SQLite");
        SqliteConnection.ClearAllPools();
        var hashBefore = HashDatabase();
        var writtenBefore = File.GetLastWriteTimeUtc(DatabasePath);
        var filesBefore = Directory.GetFiles(_dataDirectory, $"{AppDatabase.SqliteFileName}*");
        var postgres = await _server.CreateDatabaseAsync();

        await BootAsync(postgres, async client =>
        {
            await AssertEngineAsync(client, "PostgreSQL");
            (await ListIntegrationIdsAsync(client)).ShouldBeEmpty();
        });

        await using (var db = CreatePostgresContext(postgres))
        {
            (await db.Integrations.AnyAsync()).ShouldBeFalse();
            (await db.WhatsNewStates.CountAsync()).ShouldBe(1);
            (await db.ApplicationSettings.CountAsync()).ShouldBe(1);
        }

        HashDatabase().ShouldBe(hashBefore);
        File.GetLastWriteTimeUtc(DatabasePath).ShouldBe(writtenBefore);
        Directory.GetFiles(_dataDirectory, $"{AppDatabase.SqliteFileName}*").ShouldBe(filesBefore);
        await using (var sqlite = new SqliteAppDbContext(
            new DbContextOptionsBuilder<SqliteAppDbContext>().UseSqlite($"Data Source={DatabasePath};Mode=ReadOnly").Options))
            (await sqlite.Integrations.Select(integration => integration.Id).ToListAsync()).ShouldBe([sqliteIntegration]);
    }

    private async Task<Guid> BootAndCreateIntegrationAsync(string? postgresConnection, string expectedEngine)
    {
        var id = Guid.Empty;
        await BootAsync(postgresConnection, async client =>
        {
            await AssertEngineAsync(client, expectedEngine);
            var payload = JsonSerializer.Serialize(new Dictionary<string, string>
            {
                ["baseUrl"] = "https://seedpool.org/",
                ["apiKey"] = "switch-api-key",
                ["required_ratio"] = "1.00",
                ["cron"] = "0 0 1 1 *"
            });
            var response = await client.PostAsJsonAsync("/api/integrations", new { pluginId = "seedpool", payload });
            response.StatusCode.ShouldBe(HttpStatusCode.Created);
            id = (await response.Content.ReadFromJsonAsync<JsonElement>(JsonOptions)).GetProperty("id").GetGuid();
        });
        return id;
    }

    private Task BootAsync(string? postgresConnection, Func<HttpClient, Task> act) =>
        TestApp.BootAsync(_dataDirectory, postgresConnection, (_, client) => act(client));

    private static async Task AssertEngineAsync(HttpClient client, string engine)
    {
        var about = await client.GetFromJsonAsync<JsonElement>("/api/about", JsonOptions);
        about.GetProperty("databaseEngine").GetString().ShouldBe(engine);
    }

    private static async Task<List<Guid>> ListIntegrationIdsAsync(HttpClient client)
    {
        var integrations = await client.GetFromJsonAsync<List<JsonElement>>("/api/integrations", JsonOptions);
        integrations.ShouldNotBeNull();
        return integrations.Select(integration => integration.GetProperty("id").GetGuid()).ToList();
    }

    private static async Task<string> ReadPostgresAsync(string connectionString)
    {
        await using var db = CreatePostgresContext(connectionString);
        var integrations = await db.Integrations.AsNoTracking().OrderBy(i => i.Id).ToListAsync();
        var snapshots = await db.IntegrationSnapshots.AsNoTracking().OrderBy(s => s.Id).ToListAsync();
        var settings = await db.ApplicationSettings.AsNoTracking().OrderBy(s => s.Id).ToListAsync();
        var whatsNew = await db.WhatsNewStates.AsNoTracking().OrderBy(w => w.Id).ToListAsync();
        return JsonSerializer.Serialize(new { integrations, snapshots, settings, whatsNew });
    }

    private static PostgresAppDbContext CreatePostgresContext(string connectionString) =>
        new(new DbContextOptionsBuilder<PostgresAppDbContext>().UseNpgsql(connectionString).Options);

    private string HashDatabase() => Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(DatabasePath)));
}

public sealed class PostgresServer : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:17-alpine")
        .WithDatabase("trackerstats")
        .WithUsername("postgres")
        .WithPassword("switch-postgres-password")
        .Build();

    public Task InitializeAsync() => _postgres.StartAsync();

    public Task DisposeAsync() => _postgres.DisposeAsync().AsTask();

    // trackarr never creates its database, so each test creates an empty one first.
    public async Task<string> CreateDatabaseAsync()
    {
        var name = $"trackarr_{Guid.NewGuid():N}";
        await using var admin = new NpgsqlConnection(_postgres.GetConnectionString());
        await admin.OpenAsync();
        await using var create = new NpgsqlCommand($"CREATE DATABASE {name}", admin);
        await create.ExecuteNonQueryAsync();
        return new NpgsqlConnectionStringBuilder(_postgres.GetConnectionString()) { Database = name }.ConnectionString;
    }
}
