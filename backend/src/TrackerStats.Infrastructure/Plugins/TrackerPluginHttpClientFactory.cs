using TrackerStats.Domain.Plugins;

namespace TrackerStats.Infrastructure.Plugins;

public class TrackerPluginHttpClientFactory(IHttpClientFactory httpClientFactory) : ITrackerPluginHttpClientFactory
{
    public HttpClient CreateClient(ITrackerPlugin plugin)
    {
        var httpClient = httpClientFactory.CreateClient();
        plugin.ConfigureHttpClient(httpClient);
        return httpClient;
    }
}
