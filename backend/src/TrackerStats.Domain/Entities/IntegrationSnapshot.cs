namespace TrackerStats.Domain.Entities;

public class IntegrationSnapshot
{
    public Guid Id { get; set; }
    public Guid IntegrationId { get; set; }
    public DateTime CapturedAt { get; set; }
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
