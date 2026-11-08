namespace TrackerStats.Domain.Entities;

public class WhatsNewState
{
    public const int SingletonId = 1;

    public int Id { get; set; }
    public string? LastReadAppVersion { get; set; }
    public long? LastReadPluginChangeId { get; set; }
    public DateTime? LastReadAt { get; set; }
}
