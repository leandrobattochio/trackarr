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
        CancellationToken ct) =>
        (await ExecuteWithReportAsync(definition, configuration, httpClient, ct)).ToFetchResult();

    public async Task<PluginExecutionReport> ExecuteWithReportAsync(
        PluginDefinition definition,
        PluginConfiguration configuration,
        HttpClient httpClient,
        CancellationToken ct)
    {
        var redactor = PluginSecretRedactor.Create(definition, configuration);
        var steps = new List<PluginStepReport>();

        PluginExecutionReport Failure(PluginProcessResult result, string error, PluginFieldFailure? field = null) =>
            new(result, null, steps, field, redactor.Redact(error));

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
                var statusCode = (int)response.StatusCode;
                var path = redactor.Redact(GetPathWithoutQuery(request.RequestUri));
                steps.Add(new PluginStepReport(step.Name, method.Method, path, statusCode));

                if (!response.IsSuccessStatusCode)
                {
                    logger.LogWarning(
                        "Plugin '{PluginId}' step '{StepName}' got HTTP {StatusCode} from {Method} {Path}.",
                        definition.PluginId,
                        step.Name,
                        statusCode,
                        method.Method,
                        path);
                }

                var responseBody = await response.Content.ReadAsStringAsync(ct);

                var authResult = authFailureDetector.Detect(response, responseBody, definition.AuthFailure);
                if (authResult is not null)
                {
                    return Failure(authResult.Result, response.IsSuccessStatusCode
                        ? $"Step '{step.Name}' matched an authentication failure pattern."
                        : $"Step '{step.Name}' got HTTP {statusCode}, which means authentication failed.");
                }

                if (!response.IsSuccessStatusCode)
                    return Failure(PluginProcessResult.UnknownError, $"Step '{step.Name}' got HTTP {statusCode}.");

                stepResults[step.Name] = ExtractValues(step, responseBody);
            }

            var result = resultMapper.BuildResult(definition, configuration, stepResults);
            return new PluginExecutionReport(result.Result, result.Stats, steps);
        }
        catch (PluginFieldException fieldEx)
        {
            logger.Log(
                fieldEx.InnerException is null ? LogLevel.Warning : LogLevel.Error,
                fieldEx,
                "YAML plugin '{PluginId}' failed on field '{Field}' of step '{StepName}' with result '{Result}'.",
                definition.PluginId,
                fieldEx.Field,
                fieldEx.Step ?? "mapping",
                fieldEx.Result);
            var error = redactor.Redact(fieldEx.Message);
            return Failure(fieldEx.Result, error, new PluginFieldFailure(fieldEx.Step, fieldEx.Field, error));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "YAML plugin engine failed for plugin '{PluginId}'.", definition.PluginId);
            return Failure(PluginProcessResult.UnknownError, ex.Message);
        }
    }

    private static string GetPathWithoutQuery(Uri? uri)
    {
        if (uri is null)
            return string.Empty;

        return uri.IsAbsoluteUri
            ? uri.AbsolutePath
            : uri.OriginalString.Split('?', '#')[0];
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
            try
            {
                var strategy = extractionStrategies.FirstOrDefault(s => s.CanHandle(rule))
                    ?? throw new InvalidOperationException(
                        $"Extract rule '{fieldName}' in step '{step.Name}' must define regex or path.");

                var value = strategy.Extract(step, fieldName, rule, responseBody, jsonRoot);
                extractedValues[fieldName] = ApplyTransform(value, rule.Transform);
            }
            catch (Exception ex)
            {
                throw new PluginFieldException(PluginProcessResult.UnknownError, step.Name, fieldName, ex.Message, ex);
            }
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
                throw CreateValidationFailure(step, validation);
            }
        }
    }

    private static PluginFieldException CreateValidationFailure(StepDefinition step, ValidationRule validation)
    {
        var result = validation.OnFail.Equals("authFailed", StringComparison.OrdinalIgnoreCase)
            ? PluginProcessResult.AuthFailed
            : PluginProcessResult.UnknownError;

        return new PluginFieldException(
            result,
            step.Name,
            validation.Field,
            $"Field '{validation.Field}' in step '{step.Name}' failed validation rule '{validation.Rule}'.");
    }
}
