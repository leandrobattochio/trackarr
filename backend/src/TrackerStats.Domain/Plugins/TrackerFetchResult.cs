namespace TrackerStats.Domain.Plugins;

public record TrackerFetchResult(
    PluginProcessResult Result,
    TrackerStats? Stats = null
);
