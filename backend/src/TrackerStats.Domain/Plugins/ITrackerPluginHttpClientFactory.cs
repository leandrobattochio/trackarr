namespace TrackerStats.Domain.Plugins;

public interface ITrackerPluginHttpClientFactory
{
    HttpClient CreateClient(ITrackerPlugin plugin);
}
