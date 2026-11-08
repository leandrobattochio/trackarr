using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using TrackerStats.Domain.Entities;
using TrackerStats.Infrastructure.Data;

namespace TrackerStats.Backend.Tests;

public sealed class ProviderMigrationsTests : IDisposable
{
    private readonly string _directory = Path.Combine(Path.GetTempPath(), $"trackarr-sqlite-migrations-{Guid.NewGuid():N}");

    public ProviderMigrationsTests() => Directory.CreateDirectory(_directory);

    [Fact]
    public async Task Sqlite_migrations_should_create_every_table_and_seed_whats_new_state()
    {
        var databasePath = Path.Combine(_directory, "trackarr.db");
        var options = new DbContextOptionsBuilder<SqliteAppDbContext>()
            .UseSqlite($"Data Source={databasePath}")
            .Options;

        await using (var db = new SqliteAppDbContext(options))
        {
            await db.Database.MigrateAsync();
            (await db.Database.GetPendingMigrationsAsync()).ShouldBeEmpty();
            (await db.Database.GetAppliedMigrationsAsync()).ShouldBe(db.Database.GetMigrations());
        }

        File.Exists(databasePath).ShouldBeTrue();

        await using (var connection = new SqliteConnection($"Data Source={databasePath}"))
        {
            await connection.OpenAsync();
            var command = connection.CreateCommand();
            command.CommandText = "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name";
            var tables = new List<string>();
            await using (var reader = await command.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                    tables.Add(reader.GetString(0));
            }

            tables.ShouldBe(
            [
                "ApplicationSettings",
                "IntegrationSnapshots",
                "Integrations",
                "Proxies",
                "WhatsNewState",
                "__EFMigrationsHistory",
                "__EFMigrationsLock"
            ], ignoreOrder: true);
        }

        await using (var db = new SqliteAppDbContext(options))
        {
            var state = await db.WhatsNewStates.SingleAsync();
            state.Id.ShouldBe(WhatsNewState.SingletonId);
            state.LastReadAppVersion.ShouldBeNull();
            state.LastReadPluginChangeId.ShouldBeNull();
            state.LastReadAt.ShouldBeNull();
        }
    }

    [Fact]
    public void Postgres_migrations_should_keep_their_existing_ids()
    {
        var options = new DbContextOptionsBuilder<PostgresAppDbContext>()
            .UseNpgsql("Host=localhost;Database=trackarr")
            .Options;

        using var db = new PostgresAppDbContext(options);

        db.Database.GetMigrations().ShouldBe(
            ["20260406043447_Initial", "20261107231750_WhatsNewState", "20261108064312_AddProxies"]);
    }

    [Fact]
    public void Sqlite_migrations_should_match_the_model()
    {
        using var db = new SqliteAppDbContextFactory().CreateDbContext([]);

        db.Database.HasPendingModelChanges().ShouldBeFalse(
            "Add a migration: dotnet ef migrations add <Name> --context SqliteAppDbContext (see the Development page of the wiki).");
    }

    [Fact]
    public void Postgres_migrations_should_match_the_model()
    {
        using var db = new PostgresAppDbContextFactory().CreateDbContext([]);

        db.Database.HasPendingModelChanges().ShouldBeFalse(
            "Add a migration: dotnet ef migrations add <Name> --context PostgresAppDbContext (see the Development page of the wiki).");
    }

    public void Dispose()
    {
        SqliteConnection.ClearAllPools();
        Directory.Delete(_directory, recursive: true);
    }
}
