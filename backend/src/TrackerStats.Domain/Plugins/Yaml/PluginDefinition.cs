using TrackerStats.Domain.Plugins;

namespace TrackerStats.Domain.Plugins.Yaml;

public class PluginDefinition
{
    public required string PluginId { get; set; }
    public required string DisplayName { get; set; }
    public List<string> BaseUrls { get; set; } = [];
    public List<FieldDefinition> Fields { get; set; } = [];
    public List<FieldDefinition> CustomFields { get; set; } = [];
    public HttpConfig? Http { get; set; }
    public AuthFailureConfig? AuthFailure { get; set; }
    public List<StepDefinition> Steps { get; set; } = [];
    public MappingConfig? Mapping { get; set; }
    public required DashboardConfig Dashboard { get; set; }
}
