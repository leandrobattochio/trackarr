using System.Text.Json;
using TrackerStats.Domain.Entities;
using TrackerStats.Domain.Plugins;
using TrackerStats.Domain.Plugins.Yaml;
using TrackerStats.Domain.Services;
using TrackerStats.Infrastructure.Plugins.Yaml;
using TrackerStats.Infrastructure.Services;

namespace TrackerStats.Infrastructure.Plugins;

public enum PluginDryRunRejection
{
    InvalidRequest,
    NotFound
}

public sealed record PluginDryRunOutcome(
    PluginExecutionReport? Report,
    PluginDryRunRejection? Rejection = null,
    string? Error = null);

public sealed class PluginDryRunService(
    IYamlPluginDefinitionLoader loader,
    IApplicationSettingsService settingsService,
    IYamlPluginEngine engine,
    ITemplateInterpolator interpolator,
    ITrackerPluginHttpClientFactory httpClientFactory)
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public async Task<PluginDryRunOutcome> RunAsync(Integration integration, string? yaml, bool useOfficial, CancellationToken ct)
    {
        var (definition, rejection, error) = useOfficial
            ? ResolveOfficial(integration.PluginId)
            : ResolveYaml(integration.PluginId, yaml);
        if (definition is null)
            return new PluginDryRunOutcome(null, rejection, error);

        var payloadResult = IntegrationConfigurationValidator.ValidatePayload(
            new YamlTrackerPlugin(definition, engine, interpolator), integration.Payload);
        if (!payloadResult.IsValid)
            return new PluginDryRunOutcome(ConfigurationFailure(payloadResult.Error!));

        var configuration = new PluginConfiguration(
            JsonSerializer.Deserialize<Dictionary<string, string?>>(integration.Payload, JsonOptions) ?? []);
        var plugin = new YamlTrackerPlugin(definition, engine, interpolator, configuration);
        HttpClient httpClient;
        try
        {
            httpClient = httpClientFactory.CreateClient(plugin, integration.Proxy);
        }
        catch (Exception ex)
        {
            var redactor = PluginSecretRedactor.Create(definition, configuration);
            return new PluginDryRunOutcome(ConfigurationFailure(redactor.Redact(ex.Message)));
        }

        using (httpClient)
            return new PluginDryRunOutcome(await engine.ExecuteWithReportAsync(definition, configuration, httpClient, ct));
    }

    private (PluginDefinition?, PluginDryRunRejection?, string?) ResolveYaml(string pluginId, string? yaml)
    {
        var validation = PluginDefinitionValidator.Validate(yaml ?? string.Empty);
        if (validation.Error is not null)
            return (null, PluginDryRunRejection.InvalidRequest, validation.Error);

        var definition = validation.Definition!;
        if (!string.Equals(definition.PluginId, pluginId, StringComparison.OrdinalIgnoreCase))
            return (null, PluginDryRunRejection.InvalidRequest,
                $"The YAML is plugin '{definition.PluginId}', but the integration uses plugin '{pluginId}'.");

        PluginDefinitionDefaults.ApplyDefaults(definition, settingsService.GetRequired().UserAgent);
        return (definition, null, null);
    }

    private (PluginDefinition?, PluginDryRunRejection?, string?) ResolveOfficial(string pluginId)
    {
        var official = loader.LoadAllDefinitions()
            .FirstOrDefault(plugin => plugin.Origin == PluginOrigin.Official
                                      && string.Equals(plugin.PluginId, pluginId, StringComparison.OrdinalIgnoreCase));
        if (official is null)
            return (null, PluginDryRunRejection.NotFound, $"Plugin '{pluginId}' has no official version installed.");

        return official.IsValid
            ? (official.Definition, null, null)
            : (null, PluginDryRunRejection.InvalidRequest, official.Error ?? $"The official plugin '{pluginId}' could not be loaded.");
    }

    private static PluginExecutionReport ConfigurationFailure(string error) =>
        new(PluginProcessResult.UnknownError, null, [], Error: error);
}
