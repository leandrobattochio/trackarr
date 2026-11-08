using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using TrackerStats.Infrastructure.Data;
using TrackerStats.Infrastructure.Plugins.Storage;
using TrackerStats.Infrastructure.Services;

namespace TrackerStats.Backend.Tests;

public sealed class AboutServiceTests : IDisposable
{
    private readonly string _directory = Path.Combine(Path.GetTempPath(), $"trackarr-about-{Guid.NewGuid():N}");

    public AboutServiceTests() => Directory.CreateDirectory(_directory);

    [Fact]
    public async Task Get_should_report_sqlite_and_the_database_file_path()
    {
        var databasePath = Path.Combine(_directory, "trackarr.db");
        var connectionString = new SqliteConnectionStringBuilder { DataSource = databasePath, Pooling = true }.ToString();
        await using var db = new SqliteAppDbContext(new DbContextOptionsBuilder<SqliteAppDbContext>()
            .UseSqlite(connectionString)
            .Options);
        await db.Database.MigrateAsync();
        var service = new AboutService(db, PluginStorageLayout.ForDataDirectory(_directory), new FakeHostEnvironment(_directory));

        var about = service.Get();

        about.DatabaseEngine.ShouldBe("SQLite");
        about.DatabasePath.ShouldBe(databasePath);
        about.AppliedMigrations.ShouldBe(db.Database.GetMigrations().Count());
    }

    [Fact]
    public void DescribeDatabase_should_report_postgresql_without_a_path()
    {
        using var db = new PostgresAppDbContext(new DbContextOptionsBuilder<PostgresAppDbContext>()
            .UseNpgsql("Host=localhost;Database=trackarr;Username=trackarr;Password=secret")
            .Options);

        AboutService.DescribeDatabase(db.Database).ShouldBe(("PostgreSQL", (string?)null));
    }

    [Fact]
    public void DescribeDatabase_should_report_unknown_for_any_other_provider()
    {
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"about-{Guid.NewGuid():N}")
            .Options);

        AboutService.DescribeDatabase(db.Database).ShouldBe(("Unknown", (string?)null));
    }

    public void Dispose()
    {
        SqliteConnection.ClearAllPools();
        if (Directory.Exists(_directory))
            Directory.Delete(_directory, recursive: true);
    }
}
