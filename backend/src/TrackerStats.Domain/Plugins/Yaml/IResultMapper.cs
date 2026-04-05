namespace TrackerStats.Domain.Plugins.Yaml;

public interface IResultMapper
{
    TrackerFetchResult BuildResult(
        PluginDefinition definition,
        PluginConfiguration configuration,
        Dictionary<string, Dictionary<string, string>> stepResults);
}
