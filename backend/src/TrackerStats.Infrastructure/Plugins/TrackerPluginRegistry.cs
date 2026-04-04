using Microsoft.Extensions.DependencyInjection;
using TrackerStats.Domain.Plugins;

namespace TrackerStats.Infrastructure.Plugins;

public class TrackerPluginRegistry : ITrackerPluginRegistry
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IReadOnlyDictionary<string, Type> _pluginTypes;

    public TrackerPluginRegistry(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
        _pluginTypes = _serviceProvider
            .GetServices<ITrackerPlugin>()
            .GroupBy(p => p.PluginId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First().GetType(), StringComparer.OrdinalIgnoreCase);
    }

    public ITrackerPlugin? GetById(string pluginId) =>
        _pluginTypes.TryGetValue(pluginId, out var pluginType)
            ? (ITrackerPlugin)ActivatorUtilities.CreateInstance(_serviceProvider, pluginType)
            : null;

    public ITrackerPlugin? CreateById(string pluginId, PluginConfiguration configuration) =>
        _pluginTypes.TryGetValue(pluginId, out var pluginType)
            ? (ITrackerPlugin)ActivatorUtilities.CreateInstance(_serviceProvider, pluginType, configuration)
            : null;

    public IReadOnlyList<ITrackerPlugin> GetAll() =>
        _pluginTypes.Values
            .Select(pluginType => (ITrackerPlugin)ActivatorUtilities.CreateInstance(_serviceProvider, pluginType))
            .ToList();
}
