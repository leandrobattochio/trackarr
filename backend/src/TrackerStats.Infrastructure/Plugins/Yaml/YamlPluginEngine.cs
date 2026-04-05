using System.Globalization;
using System.Text.Json;
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

    internal static void ConfigureHttpClient(
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

    protected virtual Dictionary<string, string> ExtractValues(StepDefinition step, string responseBody)
    {
        var extractedValues = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        JsonElement? jsonRoot = null;

        if (step.ResponseType.Equals("json", StringComparison.OrdinalIgnoreCase))
            jsonRoot = JsonDocument.Parse(responseBody).RootElement.Clone();

        foreach (var (fieldName, rule) in step.Extract)
        {
            var value = ExtractValue(step, fieldName, rule, responseBody, jsonRoot);
            extractedValues[fieldName] = ApplyTransform(value, rule.Transform);
        }

        ValidateExtractedValues(step, extractedValues);
        return extractedValues;
    }

    protected virtual TrackerFetchResult BuildResult(
        PluginDefinition definition,
        PluginConfiguration configuration,
        Dictionary<string, Dictionary<string, string>> stepResults)
    {
        var mapping = definition.Mapping ?? throw new InvalidOperationException(
            $"Plugin '{definition.PluginId}' is missing a mapping definition.");

        var stats = new Domain.Plugins.TrackerStats(
            Ratio: ResolveRequiredDecimal(mapping.Ratio, configuration, stepResults, nameof(mapping.Ratio)),
            UploadedBytes: ResolveRequiredLong(mapping.UploadedBytes, configuration, stepResults, nameof(mapping.UploadedBytes)),
            DownloadedBytes: ResolveRequiredLong(mapping.DownloadedBytes, configuration, stepResults, nameof(mapping.DownloadedBytes)),
            SeedBonus: ResolveOptionalString(mapping.SeedBonus, configuration, stepResults),
            Buffer: ResolveOptionalString(mapping.Buffer, configuration, stepResults),
            HitAndRuns: ResolveOptionalInt(mapping.HitAndRuns, configuration, stepResults),
            RequiredRatio: ResolveRequiredDecimal(mapping.RequiredRatio, configuration, stepResults, nameof(mapping.RequiredRatio)),
            SeedingTorrents: ResolveRequiredInt(mapping.SeedingTorrents, configuration, stepResults, nameof(mapping.SeedingTorrents)),
            LeechingTorrents: ResolveRequiredInt(mapping.LeechingTorrents, configuration, stepResults, nameof(mapping.LeechingTorrents)),
            ActiveTorrents: ResolveRequiredInt(mapping.ActiveTorrents, configuration, stepResults, nameof(mapping.ActiveTorrents)));

        return new TrackerFetchResult(PluginProcessResult.Success, stats);
    }

    private static string ExtractValue(
        StepDefinition step,
        string fieldName,
        ExtractionRule rule,
        string responseBody,
        JsonElement? jsonRoot)
    {
        if (rule.CountMatches)
        {
            if (string.IsNullOrWhiteSpace(rule.Regex))
                throw new InvalidOperationException($"Extract rule '{fieldName}' in step '{step.Name}' requires a regex when countMatches is enabled.");

            var count = Regex.Matches(
                responseBody,
                rule.Regex,
                RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Singleline).Count;
            return count.ToString(CultureInfo.InvariantCulture);
        }

        if (!string.IsNullOrWhiteSpace(rule.Regex))
            return ExtractRegexValue(step, fieldName, rule.Regex, responseBody);

        if (!string.IsNullOrWhiteSpace(rule.Path))
        {
            if (jsonRoot is null)
                throw new InvalidOperationException($"Extract rule '{fieldName}' in step '{step.Name}' requires a JSON response.");

            return ExtractJsonValue(step, fieldName, rule.Path, jsonRoot.Value);
        }

        throw new InvalidOperationException($"Extract rule '{fieldName}' in step '{step.Name}' must define regex or path.");
    }

    private static string ExtractRegexValue(
        StepDefinition step,
        string fieldName,
        string pattern,
        string responseBody)
    {
        var match = Regex.Match(
            responseBody,
            pattern,
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Singleline);

        if (!match.Success)
            throw new InvalidOperationException($"Failed to extract '{fieldName}' from step '{step.Name}' using regex '{pattern}'.");

        if (match.Groups.TryGetValue(fieldName, out var namedFieldGroup) && namedFieldGroup.Success)
            return namedFieldGroup.Value.Trim();

        if (match.Groups.TryGetValue("value", out var valueGroup) && valueGroup.Success)
            return valueGroup.Value.Trim();

        foreach (var groupName in match.Groups.Keys)
        {
            if (!int.TryParse(groupName, out _) && match.Groups[groupName].Success)
                return match.Groups[groupName].Value.Trim();
        }

        if (match.Groups.Count > 1 && match.Groups[1].Success)
            return match.Groups[1].Value.Trim();

        return match.Value.Trim();
    }

    private static string ExtractJsonValue(
        StepDefinition step,
        string fieldName,
        string path,
        JsonElement root)
    {
        var current = root;
        foreach (var segment in path.Split('.', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (current.ValueKind is not JsonValueKind.Object || !TryGetPropertyIgnoreCase(current, segment, out current))
                throw new InvalidOperationException($"Failed to extract '{fieldName}' from step '{step.Name}' using JSON path '{path}'.");
        }

        return current.ValueKind switch
        {
            JsonValueKind.String => current.GetString()?.Trim() ?? string.Empty,
            JsonValueKind.Number => current.GetRawText(),
            JsonValueKind.True => bool.TrueString,
            JsonValueKind.False => bool.FalseString,
            JsonValueKind.Null => string.Empty,
            _ => current.GetRawText()
        };
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

    private static Exception CreateValidationFailure(ValidationRule validation)
    {
        var result = validation.OnFail.Equals("authFailed", StringComparison.OrdinalIgnoreCase)
            ? PluginProcessResult.AuthFailed
            : PluginProcessResult.UnknownError;

        return new YamlPluginValidationException(result);
    }

    private static string ApplyTransform(string value, string? transform)
    {
        if (string.IsNullOrWhiteSpace(transform))
            return value.Trim();

        return transform.ToLowerInvariant() switch
        {
            "bytesize" => ParseByteSize(value).ToString(CultureInfo.InvariantCulture),
            "decimal" => ParseDecimalValue(value).ToString(CultureInfo.InvariantCulture),
            "integer" => ParseIntegerValue(value).ToString(CultureInfo.InvariantCulture),
            "tostring" => value.Trim(),
            _ => throw new InvalidOperationException($"Unsupported transform '{transform}'.")
        };
    }

    private static long ParseByteSize(string value)
    {
        var parts = value.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length != 2)
            throw new InvalidOperationException($"Invalid byte size value '{value}'.");

        var amount = ParseDecimalValue(parts[0]);
        var multiplier = parts[1].ToUpperInvariant() switch
        {
            "B" => 1m,
            "KIB" => 1024m,
            "MIB" => 1024m * 1024m,
            "GIB" => 1024m * 1024m * 1024m,
            "TIB" => 1024m * 1024m * 1024m * 1024m,
            "PIB" => 1024m * 1024m * 1024m * 1024m * 1024m,
            _ => throw new InvalidOperationException($"Unsupported byte unit '{parts[1]}'.")
        };

        return decimal.ToInt64(decimal.Round(amount * multiplier, MidpointRounding.AwayFromZero));
    }

    private static decimal ParseDecimalValue(string value)
    {
        var trimmed = value.Trim();

        if (trimmed.Contains(','))
        {
            var normalized = trimmed.Replace(".", string.Empty).Replace(",", ".");
            if (decimal.TryParse(normalized, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsedComma))
                return parsedComma;
        }

        if (decimal.TryParse(trimmed, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed))
            return parsed;

        throw new InvalidOperationException($"Invalid numeric value '{value}'.");
    }

    private static int ParseIntegerValue(string value)
    {
        var normalized = value.Trim().Replace(".", string.Empty).Replace(",", string.Empty);
        if (int.TryParse(normalized, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed))
            return parsed;

        throw new InvalidOperationException($"Invalid integer value '{value}'.");
    }

    private static decimal ResolveRequiredDecimal(
        string? expression,
        PluginConfiguration configuration,
        Dictionary<string, Dictionary<string, string>> stepResults,
        string fieldName)
    {
        if (string.IsNullOrWhiteSpace(expression))
            throw new InvalidOperationException($"Mapping field '{fieldName}' is required.");

        return EvaluateDecimalExpression(expression, configuration, stepResults);
    }

    private static long ResolveRequiredLong(
        string? expression,
        PluginConfiguration configuration,
        Dictionary<string, Dictionary<string, string>> stepResults,
        string fieldName)
    {
        if (string.IsNullOrWhiteSpace(expression))
            throw new InvalidOperationException($"Mapping field '{fieldName}' is required.");

        return EvaluateLongExpression(expression, configuration, stepResults);
    }

    private static int ResolveRequiredInt(
        string? expression,
        PluginConfiguration configuration,
        Dictionary<string, Dictionary<string, string>> stepResults,
        string fieldName)
    {
        if (string.IsNullOrWhiteSpace(expression))
            throw new InvalidOperationException($"Mapping field '{fieldName}' is required.");

        return EvaluateIntExpression(expression, configuration, stepResults);
    }

    private static int? ResolveOptionalInt(
        string? expression,
        PluginConfiguration configuration,
        Dictionary<string, Dictionary<string, string>> stepResults)
    {
        if (string.IsNullOrWhiteSpace(expression))
            return null;

        return EvaluateIntExpression(expression, configuration, stepResults);
    }

    private static string? ResolveOptionalString(
        string? expression,
        PluginConfiguration configuration,
        Dictionary<string, Dictionary<string, string>> stepResults)
    {
        if (string.IsNullOrWhiteSpace(expression))
            return null;

        return ResolveOperandValue(expression, configuration, stepResults);
    }

    private static int EvaluateIntExpression(
        string expression,
        PluginConfiguration configuration,
        Dictionary<string, Dictionary<string, string>> stepResults)
    {
        var terms = expression.Split('+', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        checked
        {
            return terms.Sum(term => ParseIntegerValue(ResolveOperandValue(term, configuration, stepResults)));
        }
    }

    private static long EvaluateLongExpression(
        string expression,
        PluginConfiguration configuration,
        Dictionary<string, Dictionary<string, string>> stepResults)
    {
        var terms = expression.Split('+', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        checked
        {
            return terms.Sum(term => long.Parse(ResolveOperandValue(term, configuration, stepResults), CultureInfo.InvariantCulture));
        }
    }

    private static decimal EvaluateDecimalExpression(
        string expression,
        PluginConfiguration configuration,
        Dictionary<string, Dictionary<string, string>> stepResults)
    {
        var terms = expression.Split('+', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        return terms.Sum(term => ParseDecimalValue(ResolveOperandValue(term, configuration, stepResults)));
    }

    private static string ResolveOperandValue(
        string operand,
        PluginConfiguration configuration,
        Dictionary<string, Dictionary<string, string>> stepResults)
    {
        var trimmed = operand.Trim();

        if (trimmed.StartsWith("steps.", StringComparison.OrdinalIgnoreCase))
        {
            var parts = trimmed.Split('.', 3);
            if (parts.Length == 3
                && stepResults.TryGetValue(parts[1], out var stepValues)
                && stepValues.TryGetValue(parts[2], out var value))
            {
                return value;
            }

            throw new InvalidOperationException($"Unable to resolve mapping operand '{operand}'.");
        }

        if (trimmed.StartsWith("fields.", StringComparison.OrdinalIgnoreCase))
        {
            var fieldName = trimmed["fields.".Length..];
            return configuration.GetRequiredValue(fieldName);
        }

        var directValue = configuration.GetValue(trimmed);
        if (directValue is not null)
            return directValue;

        return trimmed;
    }

    private static bool TryGetPropertyIgnoreCase(JsonElement element, string propertyName, out JsonElement value)
    {
        foreach (var property in element.EnumerateObject())
        {
            if (property.NameEquals(propertyName) || property.Name.Equals(propertyName, StringComparison.OrdinalIgnoreCase))
            {
                value = property.Value;
                return true;
            }
        }

        value = default;
        return false;
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

internal sealed class YamlPluginValidationException(PluginProcessResult result) : Exception
{
    public PluginProcessResult Result { get; } = result;
}
