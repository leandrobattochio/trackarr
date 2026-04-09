namespace TrackerStats.Domain.Services;

public sealed record ApplicationSettingsSnapshot(
    string UserAgent,
    bool CheckForUpdates,
    bool CheckForUpdatesOverridden = false);
