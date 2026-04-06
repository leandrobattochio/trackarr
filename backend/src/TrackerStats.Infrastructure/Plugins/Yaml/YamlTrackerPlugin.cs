using TrackerStats.Domain.Plugins;
using TrackerStats.Domain.Plugins.Yaml;

namespace TrackerStats.Infrastructure.Plugins.Yaml;

public sealed class YamlTrackerPlugin(
    PluginDefinition definition,
    IYamlPluginEngine engine,
    ITemplateInterpolator interpolator,
    PluginConfiguration? configuration = null)
    : ITrackerPlugin
{
    private readonly PluginConfiguration _configuration = configuration ?? new PluginConfiguration(new Dictionary<string, string?>());

    internal PluginDefinition Definition { get; } = definition;
    private IYamlPluginEngine Engine { get; } = engine;
    private ITemplateInterpolator Interpolator { get; } = interpolator;

    public string PluginId => Definition.PluginId;
    public string DisplayName => Definition.DisplayName;
    public DashboardConfig Dashboard => Definition.Dashboard;
    public AuthMode AuthMode => ResolveAuthMode(Definition);

    public IReadOnlyList<PluginField> Fields => PluginDefinitionDefaults.GetEffectiveFields(Definition)
        .Select(definitionField => new PluginField(
            definitionField.Name,
            definitionField.Label,
            definitionField.Type,
            definitionField.Required,
            definitionField.Sensitive))
        .ToList();

    public void ConfigureHttpClient(HttpClient httpClient) =>
        PluginHttpClientConfigurator.Configure(httpClient, Definition, _configuration, Interpolator);

    public Task<TrackerFetchResult> FetchStatsAsync(HttpClient httpClient, CancellationToken ct) =>
        Engine.ExecuteAsync(Definition, _configuration, httpClient, ct);

    internal YamlTrackerPlugin WithConfiguration(PluginConfiguration? configuration) =>
        new(Definition, Engine, Interpolator, configuration);

    private static AuthMode ResolveAuthMode(PluginDefinition definition)
    {
        var fields = PluginDefinitionDefaults.GetEffectiveFields(definition);

        if (fields.Any(field => field.Name.Equals("cookie", StringComparison.OrdinalIgnoreCase)))
            return AuthMode.Cookie;

        if (fields.Any(field => field.Name.Equals("apiKey", StringComparison.OrdinalIgnoreCase)))
            return AuthMode.ApiKey;

        return AuthMode.UsernamePassword;
    }
}
