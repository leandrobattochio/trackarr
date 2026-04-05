using System.Text.Json;

namespace TrackerStats.Domain.Plugins.Yaml;

public interface IExtractionStrategy
{
    bool CanHandle(ExtractionRule rule);
    string Extract(StepDefinition step, string fieldName, ExtractionRule rule, string responseBody, JsonElement? jsonRoot);
}
