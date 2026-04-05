using System.Globalization;
using TrackerStats.Domain.Plugins;
using TrackerStats.Domain.Plugins.Yaml;
using PluginTrackerStats = TrackerStats.Domain.Plugins.TrackerStats;

namespace TrackerStats.PluginEngine;

public class ResultMapper : IResultMapper
{
    public TrackerFetchResult BuildResult(
        PluginDefinition definition,
        PluginConfiguration configuration,
        Dictionary<string, Dictionary<string, string>> stepResults)
    {
        var mapping = definition.Mapping ?? throw new InvalidOperationException(
            $"Plugin '{definition.PluginId}' is missing a mapping definition.");

        var stats = new PluginTrackerStats(
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
            return terms.Sum(term => NumericParser.ParseInteger(ResolveOperandValue(term, configuration, stepResults)));
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
        return terms.Sum(term => NumericParser.ParseDecimal(ResolveOperandValue(term, configuration, stepResults)));
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
}
