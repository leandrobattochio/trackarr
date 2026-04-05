using Microsoft.Extensions.DependencyInjection;
using TrackerStats.Domain.Plugins;

namespace TrackerStats.Infrastructure.Plugins;

public class TrackerPluginRegistry : ITrackerPluginRegistry
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IReadOnlyDictionary<string, ITrackerPlugin> _plugins;

    public TrackerPluginRegistry(IServiceProvider serviceProvider, IEnumerable<ITrackerPlugin> plugins)
    {
        _serviceProvider = serviceProvider;
        _plugins = plugins
            .GroupBy(p => p.PluginId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);
    }

    public ITrackerPlugin? GetById(string pluginId) =>
        _plugins.TryGetValue(pluginId, out var plugin)
            ? CreatePluginInstance(plugin)
            : null;

    public ITrackerPlugin? CreateById(string pluginId, PluginConfiguration configuration) =>
        _plugins.TryGetValue(pluginId, out var plugin)
            ? CreatePluginInstance(plugin, configuration)
            : null;

    public IReadOnlyList<ITrackerPlugin> GetAll() =>
        _plugins.Values
            .Select(plugin => CreatePluginInstance(plugin))
            .ToList();

    private ITrackerPlugin CreatePluginInstance(ITrackerPlugin prototype, PluginConfiguration? configuration = null) =>
        prototype switch
        {
            Yaml.YamlTrackerPlugin yamlPlugin => yamlPlugin.WithConfiguration(configuration),
            _ when configuration is null => (ITrackerPlugin)ActivatorUtilities.CreateInstance(_serviceProvider, prototype.GetType()),
            _ => (ITrackerPlugin)ActivatorUtilities.CreateInstance(_serviceProvider, prototype.GetType(), configuration)
        };
}
