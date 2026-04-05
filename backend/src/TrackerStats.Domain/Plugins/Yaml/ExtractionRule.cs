namespace TrackerStats.Domain.Plugins.Yaml;

public class ExtractionRule
{
    public string? Regex { get; set; }
    public string? Path { get; set; }
    public string? Transform { get; set; }
    public bool CountMatches { get; set; }
}
