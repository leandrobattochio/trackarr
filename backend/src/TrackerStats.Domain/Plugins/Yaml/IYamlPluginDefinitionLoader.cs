namespace TrackerStats.Domain.Plugins.Yaml;

public interface IYamlPluginDefinitionLoader
{
    IReadOnlyList<LoadedYamlPluginDefinition> LoadDefinitions();
}
