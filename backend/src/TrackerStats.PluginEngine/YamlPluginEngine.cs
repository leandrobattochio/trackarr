using System.Text.Json;
using Microsoft.Extensions.Logging;
using TrackerStats.Domain.Plugins;
using TrackerStats.Domain.Plugins.Yaml;

namespace TrackerStats.PluginEngine;

public class YamlPluginEngine(
    ILogger<YamlPluginEngine> logger,
    IEnumerable<IExtractionStrategy> extractionStrategies,
    IEnumerable<ITransformStrategy> transformStrategies,
    ITemplateInterpolator templateInterpolator,
    IAuthFailureDetector authFailureDetector,
    IResultMapper resultMapper) : IYamlPluginEngine
{
    public async Task<TrackerFetchResult> ExecuteAsync(
        PluginDefinition definition,
        PluginConfiguration configuration,
        HttpClient httpClient,
        CancellationToken ct)
    {
        try
        {
            ValidateDefinition(definition);

            var stepResults = new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase);

            foreach (var step in definition.Steps)
            {
                var url = templateInterpolator.InterpolateTemplate(step.Url, configuration, stepResults);
                var method = step.Method.ToUpperInvariant() switch
                {
                    "GET" => HttpMethod.Get,
                    "POST" => HttpMethod.Post,
                    "PUT" => HttpMethod.Put,
                    "DELETE" => HttpMethod.Delete,
                    _ => throw new InvalidOperationException($"Unsupported HTTP method '{step.Method}' in step '{step.Name}'.")
                };

                using var request = new HttpRequestMessage(method, url);
                using var response = await httpClient.SendAsync(request, ct);
                var responseBody = await response.Content.ReadAsStringAsync(ct);

                var authResult = authFailureDetector.Detect(response, responseBody, definition.AuthFailure);
                if (authResult is not null)
                    return authResult;

                if (!response.IsSuccessStatusCode)
                    return new TrackerFetchResult(PluginProcessResult.UnknownError);

                var extractedValues = ExtractValues(step, responseBody);
                stepResults[step.Name] = extractedValues;
            }

            return resultMapper.BuildResult(definition, configuration, stepResults);
        }
        catch (YamlPluginValidationException validationEx)
        {
            logger.LogWarning(
                validationEx,
                "YAML plugin validation failed for plugin '{PluginId}' with result '{Result}'.",
                definition.PluginId,
                validationEx.Result);
            return new TrackerFetchResult(validationEx.Result);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "YAML plugin engine failed for plugin '{PluginId}'.", definition.PluginId);
            return new TrackerFetchResult(PluginProcessResult.UnknownError);
        }
    }

    private static void ValidateDefinition(PluginDefinition definition)
    {
        if (string.IsNullOrWhiteSpace(definition.PluginId))
            throw new InvalidOperationException("Plugin definition is missing required field 'pluginId'.");
        if (string.IsNullOrWhiteSpace(definition.DisplayName))
            throw new InvalidOperationException("Plugin definition is missing required field 'displayName'.");
        if (definition.Dashboard is null || definition.Dashboard.Metrics.Count == 0)
            throw new InvalidOperationException("Plugin definition must have at least one dashboard metric.");
        if (definition.Steps.Count == 0)
            throw new InvalidOperationException("Plugin definition must have at least one step.");
    }

    private Dictionary<string, string> ExtractValues(StepDefinition step, string responseBody)
    {
        var extractedValues = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        JsonElement? jsonRoot = null;

        if (step.ResponseType.Equals("json", StringComparison.OrdinalIgnoreCase))
            jsonRoot = JsonDocument.Parse(responseBody).RootElement.Clone();

        foreach (var (fieldName, rule) in step.Extract)
        {
            var strategy = extractionStrategies.FirstOrDefault(s => s.CanHandle(rule))
                ?? throw new InvalidOperationException(
                    $"Extract rule '{fieldName}' in step '{step.Name}' must define regex or path.");

            var value = strategy.Extract(step, fieldName, rule, responseBody, jsonRoot);
            extractedValues[fieldName] = ApplyTransform(value, rule.Transform);
        }

        ValidateExtractedValues(step, extractedValues);
        return extractedValues;
    }

    private string ApplyTransform(string value, string? transform)
    {
        if (string.IsNullOrWhiteSpace(transform))
            return value.Trim();

        var strategy = transformStrategies.FirstOrDefault(s => s.CanHandle(transform))
            ?? throw new InvalidOperationException($"Unsupported transform '{transform}'.");

        return strategy.Transform(value);
    }

    private static void ValidateExtractedValues(StepDefinition step, Dictionary<string, string> extractedValues)
    {
        foreach (var validation in step.Validate)
        {
            extractedValues.TryGetValue(validation.Field, out var value);

            if (validation.Rule.Equals("notEmpty", StringComparison.OrdinalIgnoreCase)
                && string.IsNullOrWhiteSpace(value))
            {
                throw CreateValidationFailure(validation);
            }
        }
    }

    private static YamlPluginValidationException CreateValidationFailure(ValidationRule validation)
    {
        var result = validation.OnFail.Equals("authFailed", StringComparison.OrdinalIgnoreCase)
            ? PluginProcessResult.AuthFailed
            : PluginProcessResult.UnknownError;

        return new YamlPluginValidationException(result);
    }
}

internal sealed class YamlPluginValidationException(PluginProcessResult result) : Exception
{
    public PluginProcessResult Result { get; } = result;
}
