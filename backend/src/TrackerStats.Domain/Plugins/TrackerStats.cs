namespace TrackerStats.Domain.Plugins;

public record TrackerStats(
    decimal Ratio,
    long UploadedBytes,
    long DownloadedBytes,
    string? SeedBonus,
    string? Buffer,
    int? HitAndRuns,
    decimal RequiredRatio,
    int SeedingTorrents,
    int LeechingTorrents,
    int ActiveTorrents
);
