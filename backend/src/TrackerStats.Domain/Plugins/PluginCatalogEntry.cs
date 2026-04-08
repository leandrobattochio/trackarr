namespace TrackerStats.Domain.Plugins;

public sealed record PluginCatalogEntry(
    string PluginId,
    string DisplayName,
    DashboardConfig Dashboard,
    IReadOnlyList<string> BaseUrls,
    IReadOnlyList<PluginField> Fields);
