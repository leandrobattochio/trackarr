using Microsoft.Extensions.DependencyInjection;
using TrackerStats.Domain.Plugins;
using TrackerStats.Domain.Plugins.Yaml;
using TrackerStats.Infrastructure.Plugins.Yaml;

namespace TrackerStats.Infrastructure.Plugins;

public class TrackerPluginRegistry(
    IServiceProvider serviceProvider,
    IYamlPluginEngine engine,
    ITemplateInterpolator interpolator,
    IYamlPluginDefinitionLoader loader)
    : ITrackerPluginRegistry
{
    public ITrackerPlugin? GetById(string pluginId) =>
        LoadRegistrations().TryGetValue(pluginId, out var registration)
            ? CreatePluginInstance(registration.Prototype)
            : null;

    public ITrackerPlugin? CreateById(string pluginId, PluginConfiguration configuration) =>
        LoadRegistrations().TryGetValue(pluginId, out var registration)
            ? CreatePluginInstance(registration.Prototype, configuration)
            : null;

    public IReadOnlyList<ITrackerPlugin> GetAll() =>
        LoadRegistrations().Values
            .Select(registration => CreatePluginInstance(registration.Prototype))
            .ToList();

    public IReadOnlyList<PluginCatalogEntry> GetCatalog() =>
        LoadRegistrations().Values
            .Select(registration =>
            {
                var plugin = CreatePluginInstance(registration.Prototype);
                return new PluginCatalogEntry(
                    plugin.PluginId,
                    plugin.DisplayName,
                    plugin.Dashboard,
                    plugin.Fields);
            })
            .ToList();

    private IReadOnlyDictionary<string, PluginRegistration> LoadRegistrations() =>
        loader.LoadDefinitions()
            .Where(definition => definition.IsValid)
            .GroupBy(definition => definition.Definition!.PluginId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                group => group.Key,
                group =>
                {
                    var definition = group.First();
                    return new PluginRegistration(
                        new Yaml.YamlTrackerPlugin(definition.Definition!, engine, interpolator));
                },
                StringComparer.OrdinalIgnoreCase);

    private ITrackerPlugin CreatePluginInstance(ITrackerPlugin prototype, PluginConfiguration? configuration = null) =>
        prototype switch
        {
            Yaml.YamlTrackerPlugin yamlPlugin => yamlPlugin.WithConfiguration(configuration),
            _ when configuration is null => (ITrackerPlugin)ActivatorUtilities.CreateInstance(serviceProvider, prototype.GetType()),
            _ => (ITrackerPlugin)ActivatorUtilities.CreateInstance(serviceProvider, prototype.GetType(), configuration)
        };

    private sealed record PluginRegistration(ITrackerPlugin Prototype);
}
