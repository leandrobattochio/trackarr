namespace TrackerStats.Domain.Plugins.Yaml;

public interface IYamlPluginDefinitionLoader
{
    /// <summary>The effective plugin per id: override, then custom, then official.</summary>
    IReadOnlyList<LoadedYamlPluginDefinition> LoadDefinitions();

    /// <summary>Every plugin file in every folder, including the ones another folder shadows.</summary>
    IReadOnlyList<LoadedYamlPluginDefinition> LoadAllDefinitions();
}
