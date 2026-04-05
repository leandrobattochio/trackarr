namespace TrackerStats.Domain.Plugins.Yaml;

public class HttpConfig
{
    public string? BaseUrl { get; set; }
    public Dictionary<string, string> Headers { get; set; } = new();
    public Dictionary<string, string> Cookies { get; set; } = new();
}
