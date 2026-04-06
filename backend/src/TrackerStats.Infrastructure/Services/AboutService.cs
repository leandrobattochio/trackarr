using System.Diagnostics;
using System.Reflection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using TrackerStats.Domain.Services;
using TrackerStats.Infrastructure.Data;

namespace TrackerStats.Infrastructure.Services;

public sealed class AboutService(
    AppDbContext dbContext,
    IConfiguration configuration,
    IHostEnvironment hostEnvironment) : IAboutService
{
    public AboutSnapshot Get()
    {
        var providerName = dbContext.Database.ProviderName ?? string.Empty;
        var databaseEngine = providerName.Contains("Npgsql", StringComparison.OrdinalIgnoreCase)
            ? "PostgreSQL"
            : "Unknown";

        var entryAssembly = Assembly.GetEntryAssembly();
        var informationalVersion = entryAssembly?
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?
            .InformationalVersion;
        var version = informationalVersion
            ?? entryAssembly?.GetName().Version?.ToString()
            ?? "Unknown";
        var appDataDirectory = configuration["Hangfire:Directory"]
            ?? InferAppDataDirectory(configuration["Plugins:Directory"])
            ?? "Not configured";
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

    private static string? InferAppDataDirectory(string? pluginsDirectory)
    {
        if (string.IsNullOrWhiteSpace(pluginsDirectory))
            return null;

        var fullPath = Path.GetFullPath(pluginsDirectory);
        return Path.GetDirectoryName(fullPath) ?? fullPath;
    }

    private static string FormatUptime(TimeSpan uptime) =>
        uptime.TotalHours >= 1
            ? $"{(int)uptime.TotalHours:00}:{uptime.Minutes:00}:{uptime.Seconds:00}"
            : $"{uptime.Minutes:00}:{uptime.Seconds:00}";
}
