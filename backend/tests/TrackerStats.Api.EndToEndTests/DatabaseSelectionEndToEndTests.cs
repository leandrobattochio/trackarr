using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Shouldly;
using TrackerStats.Domain.Entities;
using TrackerStats.Infrastructure.Data;

namespace TrackerStats.Api.EndToEndTests;

[Trait("Database", "Sqlite")]
public sealed class DatabaseSelectionEndToEndTests : IDisposable
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private const string PostgresPassword = "never-log-this-password";

    // Nothing listens on the discard port, so Postgres fails fast with a socket error.
    private const string UnreachablePostgres =
        $"Host=127.0.0.1;Port=9;Database=trackarr;Username=trackarr;Password={PostgresPassword};Timeout=2";

    private readonly string _dataDirectory = Path.Combine(Path.GetTempPath(), $"trackarr-dbselect-{Guid.NewGuid():N}");
    private readonly LogCollector _logs = new();

    public DatabaseSelectionEndToEndTests()
    {
        Directory.CreateDirectory(_dataDirectory);
        RepoPlugins.CopyToOfficial(_dataDirectory);
    }

    private string DatabasePath => Path.Combine(_dataDirectory, AppDatabase.SqliteFileName);

    public void Dispose()
    {
        SqliteConnection.ClearAllPools();
        if (Directory.Exists(_dataDirectory))
            Directory.Delete(_dataDirectory, recursive: true);
    }

    [Fact]
    public async Task Without_postgres_should_create_trackarr_db_migrate_and_seed()
    {
        File.Exists(DatabasePath).ShouldBeFalse();

        await BootAsync(postgresConnection: null, async (factory, client) =>
        {
            var settings = await client.GetFromJsonAsync<JsonElement>("/api/settings", JsonOptions);
            settings.GetProperty("userAgent").GetString().ShouldBe(AppDbContext.DefaultUserAgent);

            var integrations = await client.GetFromJsonAsync<List<JsonElement>>("/api/integrations", JsonOptions);
            integrations.ShouldNotBeNull();
            integrations.ShouldBeEmpty();

            var about = await client.GetFromJsonAsync<JsonElement>("/api/about", JsonOptions);
            about.GetProperty("databaseEngine").GetString().ShouldBe("SQLite");
            about.GetProperty("databasePath").GetString().ShouldBe(DatabasePath);

            using var scope = factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.ShouldBeOfType<SqliteAppDbContext>();
            db.ShouldBeSameAs(scope.ServiceProvider.GetRequiredService<SqliteAppDbContext>());
            db.Database.GetDbConnection().DataSource.ShouldBe(DatabasePath);
            (await db.Database.GetPendingMigrationsAsync()).ShouldBeEmpty();
            (await db.WhatsNewStates.CountAsync()).ShouldBe(1);
        });

        File.Exists(DatabasePath).ShouldBeTrue();
    }

    [Fact]
    public async Task Whitespace_postgres_setting_should_use_sqlite()
    {
        await BootAsync(postgresConnection: "   ", (factory, _) =>
        {
            using var scope = factory.Services.CreateScope();
            scope.ServiceProvider.GetRequiredService<AppDbContext>().ShouldBeOfType<SqliteAppDbContext>();
            return Task.CompletedTask;
        });

        File.Exists(DatabasePath).ShouldBeTrue();
    }

    [Fact]
    public async Task Sqlite_connections_should_use_wal_cache_size_and_busy_timeout()
    {
        await BootAsync(postgresConnection: null, async (factory, _) =>
        {
            using var firstScope = factory.Services.CreateScope();
            using var secondScope = factory.Services.CreateScope();
            var first = firstScope.ServiceProvider.GetRequiredService<AppDbContext>().Database;
            var second = secondScope.ServiceProvider.GetRequiredService<AppDbContext>().Database;

            // Both stay open, so they are two distinct connections rather than one reused from the pool.
            await first.OpenConnectionAsync();
            await second.OpenConnectionAsync();
            foreach (var database in new[] { first, second })
            {
                (await ReadPragmaAsync(database, "journal_mode")).ShouldBe("wal");
                (await ReadPragmaAsync(database, "cache_size")).ShouldBe("-20000");
                (await ReadPragmaAsync(database, "busy_timeout")).ShouldBe("1000");
            }
        });
    }

    [Fact]
    public async Task Without_postgres_should_serve_an_existing_trackarr_db_unchanged()
    {
        var (integrationId, snapshotIds) = await SeedSqliteDatabaseAsync();
        var before = await ReadDatabaseAsync();

        await BootAsync(postgresConnection: null, async (_, client) =>
        {
            var integrations = await client.GetFromJsonAsync<List<IntegrationResponse>>("/api/integrations", JsonOptions);
            integrations.ShouldNotBeNull();
            var integration = integrations.ShouldHaveSingleItem();
            integration.Id.ShouldBe(integrationId);
            integration.RequiredRatio.ShouldBe(1.5m);

            var snapshots = await client.GetFromJsonAsync<SnapshotsResponse>(
                $"/api/snapshots?integrationId={integrationId}&range=24h", JsonOptions);
            snapshots.ShouldNotBeNull();
            snapshots.Items.Select(item => item.GetProperty("id").GetGuid()).ShouldBe(snapshotIds, ignoreOrder: true);
            snapshots.Items.ShouldAllBe(item => item.GetProperty("ratio").GetDecimal() == 1.25m);
        });

        (await ReadDatabaseAsync()).ShouldBe(before);
    }

    [Fact]
    public async Task With_postgres_configured_should_leave_trackarr_db_untouched()
    {
        await SeedSqliteDatabaseAsync();
        SqliteConnection.ClearAllPools();
        var hashBefore = HashDatabase();
        var writtenBefore = File.GetLastWriteTimeUtc(DatabasePath);
        var filesBefore = Directory.GetFiles(_dataDirectory, $"{AppDatabase.SqliteFileName}*");

        var exception = await Should.ThrowAsync<Exception>(
            () => BootAsync(UnreachablePostgres, (_, _) => Task.CompletedTask));

        Flatten(exception).OfType<NpgsqlException>().ShouldNotBeEmpty();
        Flatten(exception).OfType<SqliteException>().ShouldBeEmpty();
        HashDatabase().ShouldBe(hashBefore);
        File.GetLastWriteTimeUtc(DatabasePath).ShouldBe(writtenBefore);
        Directory.GetFiles(_dataDirectory, $"{AppDatabase.SqliteFileName}*").ShouldBe(filesBefore);
        _logs.Messages.ShouldNotContain(message => message.Contains(AppDatabase.SqliteFileName));
    }

    [Fact]
    public async Task Startup_logs_should_name_the_engine_version_and_never_the_postgres_secret()
    {
        await BootAsync(postgresConnection: null, (_, _) => Task.CompletedTask);

        _logs.Messages.ShouldContain(message =>
            message.StartsWith("Database: SQLite 3.") && message.EndsWith($" at {DatabasePath}"));

        _logs.Clear();
        await Should.ThrowAsync<Exception>(() => BootAsync(UnreachablePostgres, (_, _) => Task.CompletedTask));

        _logs.Messages.ShouldNotBeEmpty();
        _logs.Messages.ShouldNotContain(message => message.Contains(PostgresPassword));
        _logs.Messages.ShouldNotContain(message => message.Contains("Username=trackarr"));
    }

    [Fact]
    public async Task A_file_that_is_not_a_database_should_stop_startup_with_the_corrupt_message()
    {
        await File.WriteAllBytesAsync(DatabasePath, RandomNumberGenerator.GetBytes(8192));
        var hashBefore = HashDatabase();

        var exception = await Should.ThrowAsync<DatabaseStartupException>(
            () => BootAsync(postgresConnection: null, (_, _) => Task.CompletedTask));

        exception.Message.ShouldBe(CorruptMessage);
        exception.InnerException.ShouldBeOfType<SqliteException>().SqliteErrorCode.ShouldBe(26);
        HashDatabase().ShouldBe(hashBefore);
    }

    [Fact]
    public async Task A_damaged_database_should_stop_startup_with_the_corrupt_message()
    {
        await SeedSqliteDatabaseAsync();
        SqliteConnection.ClearAllPools();
        // Keep the 100-byte header and overwrite the rest of page 1, which holds the schema table.
        await using (var file = File.OpenWrite(DatabasePath))
        {
            file.Position = 100;
            await file.WriteAsync(Enumerable.Repeat((byte)0xFF, 1024).ToArray());
        }

        var exception = await Should.ThrowAsync<DatabaseStartupException>(
            () => BootAsync(postgresConnection: null, (_, _) => Task.CompletedTask));

        exception.Message.ShouldBe(CorruptMessage);
        exception.InnerException.ShouldBeOfType<SqliteException>().SqliteErrorCode.ShouldBe(11);
    }

    private string CorruptMessage =>
        $"Database file {DatabasePath} is corrupt. Restore it from a backup, or delete it to start over.";

    private Task BootAsync(string? postgresConnection, Func<WebApplicationFactory<Program>, HttpClient, Task> act) =>
        TestApp.BootAsync(_dataDirectory, postgresConnection, act, _logs, services =>
            services.AddSingleton(new PostgresStartupRetryPolicy(wait: (_, _) => Task.CompletedTask)));

    private async Task<(Guid IntegrationId, Guid[] SnapshotIds)> SeedSqliteDatabaseAsync()
    {
        await using var db = CreateSqliteContext();
        await db.Database.MigrateAsync();

        var integration = new Integration
        {
            Id = Guid.NewGuid(),
            PluginId = "seedpool",
            Payload = """{"baseUrl":"https://seedpool.org/","apiKey":"sqlite-api-key","cron":"0 0 1 1 *"}""",
            Ratio = 1.25m,
            RequiredRatio = 1.5m
        };
        db.Integrations.Add(integration);
        var snapshots = new[] { 2, 1 }.Select(hoursAgo => new IntegrationSnapshot
        {
            Id = Guid.NewGuid(),
            IntegrationId = integration.Id,
            CapturedAt = DateTime.UtcNow.AddHours(-hoursAgo),
            Ratio = 1.25m,
            UploadedBytes = 1024L * hoursAgo
        }).ToArray();
        db.IntegrationSnapshots.AddRange(snapshots);
        await db.SaveChangesAsync();

        return (integration.Id, snapshots.Select(snapshot => snapshot.Id).ToArray());
    }

    private async Task<string> ReadDatabaseAsync()
    {
        await using var db = CreateSqliteContext();
        var integrations = await db.Integrations.AsNoTracking().OrderBy(i => i.Id).ToListAsync();
        var snapshots = await db.IntegrationSnapshots.AsNoTracking().OrderBy(s => s.Id).ToListAsync();
        return JsonSerializer.Serialize(new { integrations, snapshots });
    }

    private SqliteAppDbContext CreateSqliteContext() =>
        new(new DbContextOptionsBuilder<SqliteAppDbContext>().UseSqlite($"Data Source={DatabasePath}").Options);

    private string HashDatabase() => Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(DatabasePath)));

    private static async Task<string> ReadPragmaAsync(DatabaseFacade database, string pragma)
    {
        await using var command = database.GetDbConnection().CreateCommand();
        command.CommandText = $"PRAGMA {pragma}";
        return Convert.ToString(await command.ExecuteScalarAsync())!;
    }

    private static IEnumerable<Exception> Flatten(Exception exception)
    {
        for (Exception? current = exception; current is not null; current = current.InnerException)
        {
            yield return current;
            if (current is AggregateException aggregate)
                foreach (var inner in aggregate.InnerExceptions.SelectMany(Flatten))
                    yield return inner;
        }
    }

    private sealed class IntegrationResponse
    {
        public Guid Id { get; init; }
        public decimal? RequiredRatio { get; init; }
    }

    private sealed class SnapshotsResponse
    {
        public List<JsonElement> Items { get; init; } = [];
    }
}
