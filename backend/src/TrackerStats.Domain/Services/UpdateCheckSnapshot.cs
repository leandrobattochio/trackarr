namespace TrackerStats.Domain.Services;

public sealed record UpdateCheckSnapshot(
    bool Enabled,
    string CurrentVersion,
    string? LatestVersion,
    bool UpdateAvailable,
    string? ReleaseUrl,
    DateTimeOffset? CheckedAt,
    string? Error);
