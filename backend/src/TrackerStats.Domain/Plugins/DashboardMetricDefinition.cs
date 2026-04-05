namespace TrackerStats.Domain.Plugins;

public class DashboardMetricDefinition
{
    public required string Stat { get; set; }
    public required string Label { get; set; }
    public string Format { get; set; } = "text";
    public string Icon { get; set; } = "circle";
    public string Tone { get; set; } = "primary";
}
