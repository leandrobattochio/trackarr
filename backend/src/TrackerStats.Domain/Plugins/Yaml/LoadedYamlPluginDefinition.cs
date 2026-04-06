namespace TrackerStats.Domain.Plugins.Yaml;

public sealed record LoadedYamlPluginDefinition(
    string PluginId,
    string DisplayName,
    PluginDefinition? Definition,
    string RawContent,
    string? Error)
{
    public bool IsValid => Definition is not null && string.IsNullOrWhiteSpace(Error);
}
