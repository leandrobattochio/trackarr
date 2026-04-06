using TrackerStats.Domain.Plugins;
using TrackerStats.Domain.Plugins.Yaml;

namespace TrackerStats.PluginEngine.IntegrationTests;

internal static class TestData
{
    public static PluginDefinition CreatePluginDefinition(List<StepDefinition>? steps = null)
    {
        return new PluginDefinition
        {
            PluginId = "tracker-test",
            DisplayName = "Tracker Test",
            Dashboard = new DashboardConfig
            {
                Metrics =
                [
                    new DashboardMetricDefinition
                    {
                        Stat = "ratio",
                        Label = "Ratio"
                    }
                ]
            },
            Steps = steps ?? [],
            Mapping = new MappingConfig
            {
                Ratio = "steps.stats.ratio",
                UploadedBytes = "steps.stats.uploaded",
                DownloadedBytes = "steps.stats.downloaded",
                SeedBonus = "steps.stats.bonus",
                Buffer = "fields.bufferLabel",
                HitAndRuns = "steps.stats.hnr",
                RequiredRatio = "fields.requiredRatio",
                SeedingTorrents = "steps.stats.seeding",
                LeechingTorrents = "steps.stats.leeching",
                ActiveTorrents = "steps.stats.seeding + steps.stats.leeching"
            }
        };
    }
}
