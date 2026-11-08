namespace TrackerStats.Domain.Entities;

public enum TrackerProxyType
{
    Http,
    Socks4,
    Socks5
}

public class TrackerProxy
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public TrackerProxyType Type { get; set; }
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; }
    public string? Username { get; set; }
    public string? Password { get; set; }
}
