using YamlPluginDefinition = TrackerStats.Domain.Plugins.Yaml.PluginDefinition;

namespace TrackerStats.Infrastructure.Plugins.Yaml;

public sealed record LoadedYamlPluginDefinition(
    YamlPluginDefinition Definition,
    string Source);
