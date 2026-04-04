namespace TrackerStats.Domain.Plugins;

public abstract class TrackerPluginBase(PluginConfiguration? configuration = null) : ITrackerPlugin
{
    protected PluginConfiguration Configuration { get; } = configuration ?? new PluginConfiguration(new Dictionary<string, string?>());

    public abstract string PluginId { get; }
    public abstract string PluginGroup { get; }
    public abstract string DisplayName { get; }
    public abstract AuthMode AuthMode { get; }
    public abstract IReadOnlyList<PluginField> Fields { get; }

    public abstract void ConfigureHttpClient(HttpClient httpClient);
    public abstract Task<TrackerFetchResult> FetchStatsAsync(HttpClient httpClient, CancellationToken ct);

    protected string? GetFieldValue(string fieldName) =>
        Configuration.GetValue(fieldName);

    protected string GetRequiredFieldValue(string fieldName) =>
        Configuration.GetRequiredValue(fieldName);
}
