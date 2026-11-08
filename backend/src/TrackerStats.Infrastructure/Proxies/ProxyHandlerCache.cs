using System.Collections.Concurrent;
using System.Net;
using TrackerStats.Domain.Entities;

namespace TrackerStats.Infrastructure.Proxies;

public sealed class ProxyHandlerCache
{
    private readonly ConcurrentDictionary<Guid, (string Fingerprint, HttpMessageHandler Handler)> _handlers = new();

    public HttpMessageHandler GetHandler(TrackerProxy proxy)
    {
        var fingerprint = Fingerprint(proxy);
        var entry = _handlers.AddOrUpdate(
            proxy.Id,
            _ => (fingerprint, CreateHandler(proxy)),
            (_, current) => current.Fingerprint == fingerprint ? current : (fingerprint, CreateHandler(proxy)));
        return entry.Handler;
    }

    public static Uri ToUri(TrackerProxy proxy)
    {
        var scheme = proxy.Type switch
        {
            TrackerProxyType.Http => "http",
            TrackerProxyType.Socks4 => "socks4",
            TrackerProxyType.Socks5 => "socks5",
            _ => throw new ArgumentOutOfRangeException(nameof(proxy), proxy.Type, "Unknown proxy type.")
        };
        return new UriBuilder(scheme, proxy.Host, proxy.Port).Uri;
    }

    public static WebProxy ToWebProxy(TrackerProxy proxy) => new(ToUri(proxy))
    {
        BypassProxyOnLocal = false,
        Credentials = string.IsNullOrEmpty(proxy.Username)
            ? null
            : new NetworkCredential(proxy.Username, proxy.Password ?? string.Empty)
    };

    // HttpClientHandler's defaults, as IHttpClientFactory gives unproxied plugins, so plugins behave the same.
    public static SocketsHttpHandler CreateHandler(TrackerProxy proxy) => new()
    {
        Proxy = ToWebProxy(proxy),
        UseProxy = true,
        PooledConnectionLifetime = TimeSpan.FromMinutes(2)
    };

    private static string Fingerprint(TrackerProxy proxy) =>
        string.Join('\n', proxy.Type, proxy.Host, proxy.Port, proxy.Username, proxy.Password);
}
