namespace TrackerStats.Domain.Services;

public sealed record AboutSnapshot(
    string Version,
    string DotNetVersion,
    bool RunningInDocker,
    string DatabaseEngine,
    int AppliedMigrations,
    string AppDataDirectory,
    string StartupDirectory,
    string EnvironmentName,
    string Uptime,
    UpdateCheckSnapshot UpdateCheck);
