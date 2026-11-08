using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
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
        var providerName = dbContext.Database.ProviderName ?? string.Empty;
        var databaseEngine = providerName.Contains("Npgsql", StringComparison.OrdinalIgnoreCase)
            ? "PostgreSQL"
            : "Unknown";

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
            appliedMigrations,
            appDataDirectory,
            startupDirectory,
            hostEnvironment.EnvironmentName,
            uptime);
    }

    private static string FormatUptime(TimeSpan uptime) =>
        uptime.TotalHours >= 1
            ? $"{(int)uptime.TotalHours:00}:{uptime.Minutes:00}:{uptime.Seconds:00}"
            : $"{uptime.Minutes:00}:{uptime.Seconds:00}";
}
