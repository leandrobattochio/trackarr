namespace TrackerStats.Domain.Plugins.Yaml;

public class StepDefinition
{
    public required string Name { get; set; }
    public string Method { get; set; } = "GET";
    public required string Url { get; set; }
    public string ResponseType { get; set; } = "html";
    public Dictionary<string, ExtractionRule> Extract { get; set; } = new();
    public List<ValidationRule> Validate { get; set; } = [];
}
