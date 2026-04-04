namespace TrackerStats.Domain.Entities;

public class Integration
{
    public Guid Id { get; set; }
    public string PluginId { get; set; } = string.Empty;
    public string Payload { get; set; } = string.Empty;
    public DateTime? LastSyncAt { get; set; }
    public Plugins.PluginProcessResult? LastSyncResult { get; set; }
    public decimal? Ratio { get; set; }
    public long? UploadedBytes { get; set; }
    public long? DownloadedBytes { get; set; }
    public string? SeedBonus { get; set; }
    public string? Buffer { get; set; }
    public int? HitAndRuns { get; set; }
    public decimal? RequiredRatio { get; set; }
    public int? SeedingTorrents { get; set; }
    public int? LeechingTorrents { get; set; }
    public int? ActiveTorrents { get; set; }
}
