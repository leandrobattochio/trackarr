using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using TrackerStats.Domain.Plugins;
using TrackerStats.Domain.Plugins.Yaml;

namespace TrackerStats.Infrastructure.Plugins.Yaml;

public partial class YamlPluginEngine(ILogger<YamlPluginEngine> logger) : IYamlPluginEngine
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
            ConfigureHttpClient(httpClient, definition, configuration);

            var stepResults = new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase);

            foreach (var step in definition.Steps)
            {
                var url = InterpolateTemplate(step.Url, configuration, stepResults);
                var method = step.Method.ToUpperInvariant() switch
                {
                    "GET" => HttpMethod.Get,
                    "POST" => HttpMethod.Post,
                    "PUT" => HttpMethod.Put,
                    "DELETE" => HttpMethod.Delete,
                    _ => HttpMethod.Get
                };

                using var request = new HttpRequestMessage(method, url);
                using var response = await httpClient.SendAsync(request, ct);
                var responseBody = await response.Content.ReadAsStringAsync(ct);

                var authResult = DetectAuthFailure(response, responseBody, definition.AuthFailure);
                if (authResult is not null)
                    return authResult;

                if (!response.IsSuccessStatusCode)
                    return new TrackerFetchResult(PluginProcessResult.UnknownError);

                var extractedValues = ExtractValues(step, responseBody);
                stepResults[step.Name] = extractedValues;
            }

            return BuildResult(definition, configuration, stepResults);
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
        if (string.IsNullOrWhiteSpace(definition.PluginGroup))
            throw new InvalidOperationException("Plugin definition is missing required field 'pluginGroup'.");
        if (string.IsNullOrWhiteSpace(definition.DisplayName))
            throw new InvalidOperationException("Plugin definition is missing required field 'displayName'.");
        if (definition.Steps.Count == 0)
            throw new InvalidOperationException("Plugin definition must have at least one step.");
    }

    private static void ConfigureHttpClient(
        HttpClient httpClient,
        PluginDefinition definition,
        PluginConfiguration configuration)
    {
        var http = definition.Http;
        if (http is null)
            return;

        if (!string.IsNullOrWhiteSpace(http.BaseUrl))
        {
            var baseUrl = InterpolateFieldValues(http.BaseUrl, configuration);
            if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var uri))
                throw new InvalidOperationException($"The plugin baseUrl '{baseUrl}' is not a valid absolute URL.");
            httpClient.BaseAddress = uri;
        }

        foreach (var (headerName, headerValue) in http.Headers)
        {
            var interpolated = InterpolateFieldValues(headerValue, configuration);

            if (headerName.Equals("Cookie", StringComparison.OrdinalIgnoreCase))
            {
                httpClient.DefaultRequestHeaders.TryAddWithoutValidation(headerName, interpolated);
            }
            else if (headerName.Equals("User-Agent", StringComparison.OrdinalIgnoreCase))
            {
                httpClient.DefaultRequestHeaders.UserAgent.ParseAdd(interpolated);
            }
            else if (headerName.Equals("Accept", StringComparison.OrdinalIgnoreCase))
            {
                httpClient.DefaultRequestHeaders.Accept.ParseAdd(interpolated);
            }
            else
            {
                httpClient.DefaultRequestHeaders.TryAddWithoutValidation(headerName, interpolated);
            }
        }

        if (http.Cookies.Count > 0)
        {
            var cookieParts = http.Cookies
                .Select(c => $"{c.Key}={InterpolateFieldValues(c.Value, configuration)}");
            httpClient.DefaultRequestHeaders.TryAddWithoutValidation("Cookie",
                string.Join("; ", cookieParts));
        }
    }

    private static TrackerFetchResult? DetectAuthFailure(
        HttpResponseMessage response,
        string responseBody,
        AuthFailureConfig? authFailure)
    {
        if (authFailure is null)
        {
            if (response.StatusCode is System.Net.HttpStatusCode.Unauthorized or System.Net.HttpStatusCode.Forbidden)
                return new TrackerFetchResult(PluginProcessResult.AuthFailed);
            return null;
        }

        if (authFailure.HttpStatusCodes.Contains((int)response.StatusCode))
            return new TrackerFetchResult(PluginProcessResult.AuthFailed);

        foreach (var pattern in authFailure.HtmlPatterns)
        {
            if (responseBody.Contains(pattern, StringComparison.OrdinalIgnoreCase))
                return new TrackerFetchResult(PluginProcessResult.AuthFailed);
        }

        return null;
    }

    /// <summary>
    /// Extracts named values from a step's response body.
    /// This is a placeholder — full regex/JSON extraction is implemented in US-007.
    /// </summary>
    protected virtual Dictionary<string, string> ExtractValues(StepDefinition step, string responseBody)
    {
        return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Builds the final TrackerFetchResult from step results and mapping.
    /// This is a placeholder — full mapping/transformation logic is implemented in US-007.
    /// </summary>
    protected virtual TrackerFetchResult BuildResult(
        PluginDefinition definition,
        PluginConfiguration configuration,
        Dictionary<string, Dictionary<string, string>> stepResults)
    {
        return new TrackerFetchResult(PluginProcessResult.Success);
    }

    internal static string InterpolateTemplate(
        string template,
        PluginConfiguration configuration,
        Dictionary<string, Dictionary<string, string>> stepResults)
    {
        return TemplateRegex().Replace(template, match =>
        {
            var key = match.Groups[1].Value.Trim();

            if (key.StartsWith("steps.", StringComparison.OrdinalIgnoreCase))
            {
                var parts = key.Split('.', 3);
                if (parts.Length == 3
                    && stepResults.TryGetValue(parts[1], out var stepVars)
                    && stepVars.TryGetValue(parts[2], out var stepValue))
                {
                    return Uri.EscapeDataString(stepValue);
                }

                return match.Value;
            }

            if (key.StartsWith("fields.", StringComparison.OrdinalIgnoreCase))
            {
                var fieldName = key["fields.".Length..];
                var value = configuration.GetValue(fieldName);
                return value is not null ? Uri.EscapeDataString(value) : match.Value;
            }

            var fieldValue = configuration.GetValue(key);
            return fieldValue is not null ? Uri.EscapeDataString(fieldValue) : match.Value;
        });
    }

    private static string InterpolateFieldValues(string template, PluginConfiguration configuration)
    {
        return TemplateRegex().Replace(template, match =>
        {
            var key = match.Groups[1].Value.Trim();

            if (key.StartsWith("fields.", StringComparison.OrdinalIgnoreCase))
                key = key["fields.".Length..];

            var value = configuration.GetValue(key);
            return value ?? match.Value;
        });
    }

    [GeneratedRegex(@"\{\{([^}]+)\}\}")]
    private static partial Regex TemplateRegex();
}
