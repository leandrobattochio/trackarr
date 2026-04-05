namespace TrackerStats.Domain.Entities;

public class PluginDefinition
{
    public Guid Id { get; set; }
    public string PluginId { get; set; } = string.Empty;
    public string DefinitionJson { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
