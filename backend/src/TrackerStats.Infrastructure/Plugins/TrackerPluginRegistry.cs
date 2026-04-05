using Microsoft.Extensions.DependencyInjection;
using TrackerStats.Domain.Plugins;
using TrackerStats.Domain.Plugins.Yaml;
using TrackerStats.Infrastructure.Plugins.Yaml;

namespace TrackerStats.Infrastructure.Plugins;

public class TrackerPluginRegistry : ITrackerPluginRegistry
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IYamlPluginEngine _engine;
    private readonly IYamlPluginDefinitionLoader _loader;

    public TrackerPluginRegistry(
        IServiceProvider serviceProvider,
        IYamlPluginEngine engine,
        IYamlPluginDefinitionLoader loader)
    {
        _serviceProvider = serviceProvider;
        _engine = engine;
        _loader = loader;
    }

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
                    plugin.PluginGroup,
                    plugin.DisplayName,
                    plugin.Fields,
                    registration.Source);
            })
            .ToList();

    private IReadOnlyDictionary<string, PluginRegistration> LoadRegistrations() =>
        _loader.LoadDefinitions()
            .GroupBy(definition => definition.Definition.PluginId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                group => group.Key,
                group =>
                {
                    var definition = group.First();
                    return new PluginRegistration(
                        new Yaml.YamlTrackerPlugin(definition.Definition, _engine),
                        definition.Source);
                },
                StringComparer.OrdinalIgnoreCase);

    private ITrackerPlugin CreatePluginInstance(ITrackerPlugin prototype, PluginConfiguration? configuration = null) =>
        prototype switch
        {
            Yaml.YamlTrackerPlugin yamlPlugin => yamlPlugin.WithConfiguration(configuration),
            _ when configuration is null => (ITrackerPlugin)ActivatorUtilities.CreateInstance(_serviceProvider, prototype.GetType()),
            _ => (ITrackerPlugin)ActivatorUtilities.CreateInstance(_serviceProvider, prototype.GetType(), configuration)
        };

    private sealed record PluginRegistration(ITrackerPlugin Prototype, string Source);
}
