namespace TrackerStats.Domain.Plugins;

public class DashboardConfig
{
    public string? ByteUnitSystem { get; set; }
    public List<DashboardMetricDefinition> Metrics { get; set; } = [];
}
