using TrackerStats.Domain.Entities;

namespace TrackerStats.Domain.Plugins;

public interface ITrackerPluginHttpClientFactory
{
    HttpClient CreateClient(ITrackerPlugin plugin, TrackerProxy? proxy = null);
}
