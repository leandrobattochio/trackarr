using System.Text.RegularExpressions;
using TrackerStats.Domain.Plugins;
using TrackerStats.Domain.Plugins.Yaml;

namespace TrackerStats.PluginEngine;

public partial class TemplateInterpolator : ITemplateInterpolator
{
    public string InterpolateTemplate(
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

    public string InterpolateFieldValues(string template, PluginConfiguration configuration)
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
