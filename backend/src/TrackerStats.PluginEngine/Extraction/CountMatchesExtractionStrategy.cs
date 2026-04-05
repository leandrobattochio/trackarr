using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using TrackerStats.Domain.Plugins.Yaml;

namespace TrackerStats.PluginEngine.Extraction;

public class CountMatchesExtractionStrategy : IExtractionStrategy
{
    public bool CanHandle(ExtractionRule rule) => rule.CountMatches;

    public string Extract(StepDefinition step, string fieldName, ExtractionRule rule, string responseBody, JsonElement? jsonRoot)
    {
        if (string.IsNullOrWhiteSpace(rule.Regex))
            throw new InvalidOperationException(
                $"Extract rule '{fieldName}' in step '{step.Name}' requires a regex when countMatches is enabled.");

        var count = Regex.Matches(
            responseBody,
            rule.Regex,
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Singleline).Count;

        return count.ToString(CultureInfo.InvariantCulture);
    }
}
