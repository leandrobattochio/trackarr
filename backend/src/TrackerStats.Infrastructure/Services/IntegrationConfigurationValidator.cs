using System.Globalization;
using System.Text.Json;
using TrackerStats.Domain.Entities;
using TrackerStats.Domain.Plugins;

namespace TrackerStats.Infrastructure.Services;

public sealed class IntegrationConfigurationValidator(ITrackerPluginRegistry registry)
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public IntegrationConfigurationValidationResult Validate(Integration integration) =>
        Validate(integration.PluginId, integration.Payload);

    public IntegrationConfigurationValidationResult Validate(string pluginId, string payloadJson)
    {
        var plugin = registry.GetById(pluginId);
        if (plugin is null)
            return new IntegrationConfigurationValidationResult(false, $"Plugin '{pluginId}' not found.", null);

        Dictionary<string, string?> payload;
        try
        {
            payload = JsonSerializer.Deserialize<Dictionary<string, string?>>(payloadJson, JsonOptions) ?? [];
        }
        catch
        {
            return new IntegrationConfigurationValidationResult(false, "Payload is not valid JSON.", plugin);
        }

        var missingFields = plugin.Fields
            .Where(field => field.Required && string.IsNullOrWhiteSpace(payload.GetValueOrDefault(field.Name)))
            .Select(field => field.Name)
            .ToList();

        if (missingFields.Count > 0)
            return new IntegrationConfigurationValidationResult(
                false,
                $"Integration is missing required fields: {string.Join(", ", missingFields)}.",
                plugin);

        foreach (var field in plugin.Fields.Where(field => string.Equals(field.Type, "number", StringComparison.OrdinalIgnoreCase)))
        {
            var rawValue = payload.GetValueOrDefault(field.Name);
            if (string.IsNullOrWhiteSpace(rawValue))
                continue;

            if (!decimal.TryParse(rawValue, NumberStyles.Number, CultureInfo.InvariantCulture, out _))
            {
                return new IntegrationConfigurationValidationResult(
                    false,
                    $"Field '{field.Name}' must be a valid decimal number.",
                    plugin);
            }
        }

        foreach (var field in plugin.Fields.Where(field => string.Equals(field.Type, "cron", StringComparison.OrdinalIgnoreCase)))
        {
            var rawValue = payload.GetValueOrDefault(field.Name);
            if (string.IsNullOrWhiteSpace(rawValue))
                continue;

            if (!IsValidCronExpression(rawValue))
            {
                return new IntegrationConfigurationValidationResult(
                    false,
                    $"Field '{field.Name}' must be a valid 5-part UTC cron expression.",
                    plugin);
            }
        }

        foreach (var field in plugin.Fields.Where(field => string.Equals(field.Name, "baseUrl", StringComparison.OrdinalIgnoreCase)))
        {
            var rawValue = payload.GetValueOrDefault(field.Name);
            if (string.IsNullOrWhiteSpace(rawValue))
                continue;

            if (!Uri.TryCreate(rawValue, UriKind.Absolute, out var uri) ||
                (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            {
                return new IntegrationConfigurationValidationResult(
                    false,
                    $"Field '{field.Name}' must be a valid http:// or https:// URL.",
                    plugin);
            }
        }

        try
        {
            var configuredPlugin = registry.CreateById(pluginId, new PluginConfiguration(payload))
                ?? throw new InvalidOperationException($"Plugin '{pluginId}' not found.");

            using var httpClient = new HttpClient();
            configuredPlugin.ConfigureHttpClient(httpClient);
        }
        catch (Exception ex)
        {
            return new IntegrationConfigurationValidationResult(false, ex.Message, plugin);
        }

        return new IntegrationConfigurationValidationResult(true, null, plugin);
    }

    private static bool IsValidCronExpression(string value)
    {
        var parts = value.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        return parts.Length == 5 &&
               parts.All(part => part.All(character =>
                   char.IsDigit(character) ||
                   character is '*' or '/' or ',' or '-'));
    }
}

public sealed record IntegrationConfigurationValidationResult(
    bool IsValid,
    string? Error,
    ITrackerPlugin? Plugin);
