namespace TrackerStats.Domain.Plugins;

public interface ITrackerPlugin
{
    string PluginId { get; }
    string PluginGroup { get; }
    string DisplayName { get; }
    AuthMode AuthMode { get; }
    IReadOnlyList<PluginField> Fields { get; }
    void ConfigureHttpClient(HttpClient httpClient);
    Task<TrackerFetchResult> FetchStatsAsync(HttpClient httpClient, CancellationToken ct);
}
