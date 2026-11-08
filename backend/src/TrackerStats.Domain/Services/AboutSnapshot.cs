namespace TrackerStats.Domain.Services;

public sealed record AboutSnapshot(
    string Version,
    string DotNetVersion,
    bool RunningInDocker,
    string DatabaseEngine,
    string? DatabasePath,
    int AppliedMigrations,
    string AppDataDirectory,
    string StartupDirectory,
    string EnvironmentName,
    string Uptime);
