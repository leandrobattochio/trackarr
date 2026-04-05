using System.Text.Json;
using TrackerStats.Domain.Plugins.Yaml;

namespace TrackerStats.PluginEngine.Extraction;

public class JsonPathExtractionStrategy : IExtractionStrategy
{
    public bool CanHandle(ExtractionRule rule) =>
        !rule.CountMatches && string.IsNullOrWhiteSpace(rule.Regex) && !string.IsNullOrWhiteSpace(rule.Path);

    public string Extract(StepDefinition step, string fieldName, ExtractionRule rule, string responseBody, JsonElement? jsonRoot)
    {
        if (jsonRoot is null)
            throw new InvalidOperationException(
                $"Extract rule '{fieldName}' in step '{step.Name}' requires a JSON response.");

        var current = jsonRoot.Value;
        foreach (var segment in rule.Path!.Split('.', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (current.ValueKind is not JsonValueKind.Object || !TryGetPropertyIgnoreCase(current, segment, out current))
                throw new InvalidOperationException(
                    $"Failed to extract '{fieldName}' from step '{step.Name}' using JSON path '{rule.Path}'.");
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
}
