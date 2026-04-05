namespace TrackerStats.Domain.Plugins;

public sealed record PluginCatalogEntry(
    string PluginId,
    string PluginGroup,
    string DisplayName,
    IReadOnlyList<PluginField> Fields,
    string Source);
