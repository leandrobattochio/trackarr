namespace TrackerStats.Domain.Plugins;

public interface ITrackerPluginRegistry
{
    ITrackerPlugin? GetById(string pluginId);
    ITrackerPlugin? CreateById(string pluginId, PluginConfiguration configuration);
    IReadOnlyList<ITrackerPlugin> GetAll();
    IReadOnlyList<PluginCatalogEntry> GetCatalog();

    /// <summary>The error of the plugin's override when that override is the effective definition and is invalid.</summary>
    string? GetInvalidOverrideError(string pluginId);
}
