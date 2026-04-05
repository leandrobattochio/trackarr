using System.Text.Json;
using System.Text.RegularExpressions;
using TrackerStats.Domain.Plugins.Yaml;

namespace TrackerStats.PluginEngine.Extraction;

public class RegexExtractionStrategy : IExtractionStrategy
{
    public bool CanHandle(ExtractionRule rule) =>
        !rule.CountMatches && !string.IsNullOrWhiteSpace(rule.Regex);

    public string Extract(StepDefinition step, string fieldName, ExtractionRule rule, string responseBody, JsonElement? jsonRoot)
    {
        var match = Regex.Match(
            responseBody,
            rule.Regex!,
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Singleline);

        if (!match.Success)
            throw new InvalidOperationException(
                $"Failed to extract '{fieldName}' from step '{step.Name}' using regex '{rule.Regex}'.");

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
}
