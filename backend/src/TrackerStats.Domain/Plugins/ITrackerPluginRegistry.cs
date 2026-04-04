namespace TrackerStats.Domain.Plugins;

public interface ITrackerPluginRegistry
{
    ITrackerPlugin? GetById(string pluginId);
    ITrackerPlugin? CreateById(string pluginId, PluginConfiguration configuration);
    IReadOnlyList<ITrackerPlugin> GetAll();
}
