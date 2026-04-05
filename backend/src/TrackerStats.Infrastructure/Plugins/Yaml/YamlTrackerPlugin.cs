using TrackerStats.Domain.Plugins;
using TrackerStats.Domain.Plugins.Yaml;

namespace TrackerStats.Infrastructure.Plugins.Yaml;

public sealed class YamlTrackerPlugin : ITrackerPlugin
{
    private readonly PluginConfiguration _configuration;

    public YamlTrackerPlugin(
        PluginDefinition definition,
        IYamlPluginEngine engine,
        PluginConfiguration? configuration = null)
    {
        Definition = definition;
        Engine = engine;
        _configuration = configuration ?? new PluginConfiguration(new Dictionary<string, string?>());
    }

    internal PluginDefinition Definition { get; }
    private IYamlPluginEngine Engine { get; }

    public string PluginId => Definition.PluginId;
    public string PluginGroup => Definition.PluginGroup;
    public string DisplayName => Definition.DisplayName;
    public AuthMode AuthMode => ResolveAuthMode(Definition);

    public IReadOnlyList<PluginField> Fields => Definition.Fields
        .Select(definitionField => new PluginField(
            definitionField.Name,
            definitionField.Label,
            definitionField.Type,
            definitionField.Required,
            definitionField.Sensitive))
        .ToList();

    public void ConfigureHttpClient(HttpClient httpClient) =>
        YamlPluginEngine.ConfigureHttpClient(httpClient, Definition, _configuration);

    public Task<TrackerFetchResult> FetchStatsAsync(HttpClient httpClient, CancellationToken ct) =>
        Engine.ExecuteAsync(Definition, _configuration, httpClient, ct);

    internal YamlTrackerPlugin WithConfiguration(PluginConfiguration? configuration) =>
        new(Definition, Engine, configuration);

    private static AuthMode ResolveAuthMode(PluginDefinition definition)
    {
        if (definition.Fields.Any(field => field.Name.Equals("cookie", StringComparison.OrdinalIgnoreCase)))
            return AuthMode.Cookie;

        if (definition.Fields.Any(field => field.Name.Equals("apiKey", StringComparison.OrdinalIgnoreCase)))
            return AuthMode.ApiKey;

        return AuthMode.UsernamePassword;
    }
}
