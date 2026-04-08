namespace TrackerStats.Domain.Plugins.Yaml;

public class FieldDefinition
{
    public required string Name { get; set; }
    public required string Label { get; set; }
    public string? Description { get; set; }
    public string Type { get; set; } = "text";
    public bool Required { get; set; }
    public bool Sensitive { get; set; }
}
