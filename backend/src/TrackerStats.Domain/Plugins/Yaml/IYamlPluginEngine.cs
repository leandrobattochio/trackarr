namespace TrackerStats.Domain.Plugins.Yaml;

public interface IYamlPluginEngine
{
    Task<TrackerFetchResult> ExecuteAsync(
        PluginDefinition definition,
        PluginConfiguration configuration,
        HttpClient httpClient,
        CancellationToken ct);
}
