namespace TrackerStats.Domain.Plugins.Yaml;

public sealed record LoadedYamlPluginDefinition(
    PluginDefinition Definition,
    string Source);
