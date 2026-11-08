using TrackerStats.Domain.Entities;
using TrackerStats.Domain.Plugins;
using TrackerStats.Infrastructure.Proxies;

namespace TrackerStats.Infrastructure.Plugins;

public class TrackerPluginHttpClientFactory(IHttpClientFactory httpClientFactory, ProxyHandlerCache proxyHandlers)
    : ITrackerPluginHttpClientFactory
{
    public HttpClient CreateClient(ITrackerPlugin plugin, TrackerProxy? proxy = null)
    {
        var httpClient = proxy is null
            ? httpClientFactory.CreateClient()
            : new HttpClient(proxyHandlers.GetHandler(proxy), disposeHandler: false);
        plugin.ConfigureHttpClient(httpClient);
        return httpClient;
    }
}
