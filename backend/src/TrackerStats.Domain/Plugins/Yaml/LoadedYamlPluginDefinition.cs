namespace TrackerStats.Domain.Plugins.Yaml;

public sealed record LoadedYamlPluginDefinition(
    string PluginId,
    string DisplayName,
    PluginDefinition? Definition,
    string RawContent,
    string? Error,
    bool Incompatible = false,
    PluginOrigin Origin = PluginOrigin.Custom,
    string? FilePath = null)
{
    public bool IsValid => Definition is not null && string.IsNullOrWhiteSpace(Error);
}
