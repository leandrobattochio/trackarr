namespace TrackerStats.Infrastructure.Plugins.Yaml;

public interface IYamlPluginDefinitionLoader
{
    IReadOnlyList<LoadedYamlPluginDefinition> LoadDefinitions();
}
