using System.Diagnostics;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Hosting;
using TrackerStats.Domain.Services;
using TrackerStats.Infrastructure.Data;
using TrackerStats.Infrastructure.Plugins.Storage;
using TrackerStats.Infrastructure.Releases;

namespace TrackerStats.Infrastructure.Services;

public sealed class AboutService(
    AppDbContext dbContext,
    PluginStorageLayout pluginStorageLayout,
    IHostEnvironment hostEnvironment) : IAboutService
{
    public AboutSnapshot Get()
    {
        var (databaseEngine, databasePath) = DescribeDatabase(dbContext.Database);

        var version = InstalledAppVersion.FromEntryAssembly().Value;
        var appDataDirectory = pluginStorageLayout.DataDirectory;
        var startupDirectory = AppContext.BaseDirectory;
        var appliedMigrations = dbContext.Database.GetAppliedMigrations().Count();
        var runningInDocker = string.Equals(
            Environment.GetEnvironmentVariable("DOTNET_RUNNING_IN_CONTAINER"),
            "true",
            StringComparison.OrdinalIgnoreCase);
        var uptime = FormatUptime(DateTimeOffset.UtcNow - Process.GetCurrentProcess().StartTime.ToUniversalTime());

        return new AboutSnapshot(
            version,
            Environment.Version.ToString(),
            runningInDocker,
            databaseEngine,
            databasePath,
            appliedMigrations,
            appDataDirectory,
            startupDirectory,
            hostEnvironment.EnvironmentName,
            uptime);
    }

    public static (string Engine, string? FilePath) DescribeDatabase(DatabaseFacade database)
    {
        if (database.IsSqlite())
            return ("SQLite", new SqliteConnectionStringBuilder(database.GetConnectionString()).DataSource);

        return database.IsNpgsql() ? ("PostgreSQL", null) : ("Unknown", null);
    }

    private static string FormatUptime(TimeSpan uptime) =>
        uptime.TotalHours >= 1
            ? $"{(int)uptime.TotalHours:00}:{uptime.Minutes:00}:{uptime.Seconds:00}"
            : $"{uptime.Minutes:00}:{uptime.Seconds:00}";
}
