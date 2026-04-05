namespace TrackerStats.Domain.Plugins;

public sealed record PluginCatalogEntry(
    string PluginId,
    string DisplayName,
    DashboardConfig Dashboard,
    IReadOnlyList<PluginField> Fields,
    string Source);
