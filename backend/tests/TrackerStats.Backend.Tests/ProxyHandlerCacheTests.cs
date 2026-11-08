using System.Net;
using Shouldly;
using TrackerStats.Domain.Entities;
using TrackerStats.Infrastructure.Proxies;

namespace TrackerStats.Backend.Tests;

public sealed class ProxyHandlerCacheTests
{
    private static TrackerProxy Proxy(
        TrackerProxyType type = TrackerProxyType.Http,
        string host = "10.0.0.2",
        int port = 8888,
        string? username = null,
        string? password = null,
        Guid? id = null) => new()
    {
        Id = id ?? Guid.NewGuid(),
        Name = "proxy",
        Type = type,
        Host = host,
        Port = port,
        Username = username,
        Password = password
    };

    [Theory]
    [InlineData(TrackerProxyType.Http, "http://10.0.0.2:8888/")]
    [InlineData(TrackerProxyType.Socks4, "socks4://10.0.0.2:8888/")]
    [InlineData(TrackerProxyType.Socks5, "socks5://10.0.0.2:8888/")]
    public void Each_type_should_map_to_its_proxy_scheme(TrackerProxyType type, string expected)
    {
        ProxyHandlerCache.ToUri(Proxy(type)).ToString().ShouldBe(expected);
    }

    [Fact]
    public void An_ipv6_host_should_be_bracketed()
    {
        ProxyHandlerCache.ToUri(Proxy(TrackerProxyType.Socks5, host: "fd00::2", port: 1080)).ToString()
            .ShouldBe("socks5://[fd00::2]:1080/");
    }

    [Fact]
    public void Credentials_should_be_set_only_with_a_username()
    {
        ProxyHandlerCache.ToWebProxy(Proxy()).Credentials.ShouldBeNull();

        var credential = ProxyHandlerCache.ToWebProxy(Proxy(username: "user", password: "secret")).Credentials
            .ShouldBeOfType<NetworkCredential>();
        credential.UserName.ShouldBe("user");
        credential.Password.ShouldBe("secret");
    }

    [Fact]
    public void Local_addresses_should_go_through_the_proxy_too()
    {
        ProxyHandlerCache.ToWebProxy(Proxy()).BypassProxyOnLocal.ShouldBeFalse();
    }

    [Fact]
    public void The_handler_should_be_reused_until_the_proxy_settings_change()
    {
        var cache = new ProxyHandlerCache();
        var proxy = Proxy(username: "user", password: "one");

        var first = cache.GetHandler(proxy);
        cache.GetHandler(proxy).ShouldBeSameAs(first);

        proxy.Password = "two";
        var second = cache.GetHandler(proxy);
        second.ShouldNotBeSameAs(first);
        cache.GetHandler(proxy).ShouldBeSameAs(second);
    }

    [Fact]
    public void Different_proxies_should_get_different_handlers()
    {
        var cache = new ProxyHandlerCache();

        cache.GetHandler(Proxy()).ShouldNotBeSameAs(cache.GetHandler(Proxy()));
    }
}
