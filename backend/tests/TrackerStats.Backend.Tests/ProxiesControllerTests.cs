using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Shouldly;
using TrackerStats.Api.Controllers;
using TrackerStats.Api.Validation;
using TrackerStats.Domain.Entities;
using TrackerStats.Infrastructure.Proxies;

namespace TrackerStats.Backend.Tests;

public sealed class ProxiesControllerTests
{
    private readonly InMemoryIntegrationRepository _integrations = new();
    private readonly InMemoryProxyRepository _proxies;
    private readonly ProxiesController _controller;

    public ProxiesControllerTests()
    {
        _proxies = new InMemoryProxyRepository(_integrations);
        var registry = new FakeTrackerPluginRegistry();
        registry.Register(new FakeTrackerPlugin("seedpool"));
        _controller = new ProxiesController(
            _proxies,
            registry,
            new ProxyConnectionTester(new ConfigurationBuilder().Build()),
            new ProxyRequestValidator());
    }

    private static ProxyRequest Request(
        string name = "vpn",
        string type = "socks5",
        string host = "10.0.0.2",
        int port = 1080,
        string? username = "user",
        string? password = "secret") => new(name, type, host, port, username, password);

    private static JsonElement Body(IActionResult result) =>
        JsonSerializer.SerializeToElement(((ObjectResult)result).Value);

    [Fact]
    public async Task Create_should_trim_and_store_the_proxy_and_never_return_its_password()
    {
        var result = await _controller.Create(Request(name: "  vpn  ", host: " 10.0.0.2 "), CancellationToken.None);

        result.ShouldBeOfType<CreatedAtActionResult>();
        var body = Body(result);
        body.GetProperty("name").GetString().ShouldBe("vpn");
        body.GetProperty("type").GetString().ShouldBe("socks5");
        body.GetProperty("host").GetString().ShouldBe("10.0.0.2");
        body.GetProperty("port").GetInt32().ShouldBe(1080);
        body.GetProperty("username").GetString().ShouldBe("user");
        body.GetProperty("hasPassword").GetBoolean().ShouldBeTrue();
        body.TryGetProperty("password", out _).ShouldBeFalse();

        var stored = (await _proxies.ListAsync(CancellationToken.None)).ShouldHaveSingleItem();
        stored.Type.ShouldBe(TrackerProxyType.Socks5);
        stored.Password.ShouldBe("secret");
    }

    [Theory]
    [InlineData("", "socks5", "10.0.0.2", 1080, "Name is required.")]
    [InlineData("vpn", "ftp", "10.0.0.2", 1080, "Type must be http, socks4 or socks5.")]
    [InlineData("vpn", "http", "http://10.0.0.2", 1080, "Host must be a host name or an IP address")]
    [InlineData("vpn", "http", "10.0.0.2:8080", 1080, "Host must be a host name or an IP address")]
    [InlineData("vpn", "http", "10.0.0.2", 0, "Port must be between 1 and 65535.")]
    [InlineData("vpn", "http", "10.0.0.2", 70000, "Port must be between 1 and 65535.")]
    public async Task Create_should_reject_an_invalid_proxy(string name, string type, string host, int port, string error)
    {
        var result = await _controller.Create(Request(name, type, host, port), CancellationToken.None);

        result.ShouldBeOfType<BadRequestObjectResult>();
        Body(result).GetProperty("error").GetString().ShouldContain(error);
    }

    [Fact]
    public async Task Names_should_be_unique()
    {
        await _controller.Create(Request(), CancellationToken.None);

        var result = await _controller.Create(Request(host: "10.0.0.3"), CancellationToken.None);

        result.ShouldBeOfType<BadRequestObjectResult>();
        Body(result).GetProperty("error").GetString().ShouldBe("A proxy named 'vpn' already exists.");
    }

    [Fact]
    public async Task Update_should_keep_the_password_when_none_is_sent_and_clear_it_when_empty()
    {
        var id = Body(await _controller.Create(Request(), CancellationToken.None)).GetProperty("id").GetGuid();

        await _controller.Update(id, Request(port: 1081, password: null), CancellationToken.None);
        (await _proxies.GetByIdAsync(id, CancellationToken.None))!.Password.ShouldBe("secret");

        var cleared = await _controller.Update(id, Request(password: ""), CancellationToken.None);
        Body(cleared).GetProperty("hasPassword").GetBoolean().ShouldBeFalse();
        (await _proxies.GetByIdAsync(id, CancellationToken.None))!.Password.ShouldBeNull();
    }

    [Fact]
    public async Task Removing_the_username_should_drop_the_password()
    {
        var id = Body(await _controller.Create(Request(), CancellationToken.None)).GetProperty("id").GetGuid();

        await _controller.Update(id, Request(username: " ", password: null), CancellationToken.None);

        var stored = (await _proxies.GetByIdAsync(id, CancellationToken.None))!;
        stored.Username.ShouldBeNull();
        stored.Password.ShouldBeNull();
    }

    [Fact]
    public async Task Update_and_delete_should_answer_404_for_an_unknown_proxy()
    {
        (await _controller.Update(Guid.NewGuid(), Request(), CancellationToken.None)).ShouldBeOfType<NotFoundResult>();
        (await _controller.Delete(Guid.NewGuid(), CancellationToken.None)).ShouldBeOfType<NotFoundResult>();
    }

    [Fact]
    public async Task A_proxy_in_use_should_not_be_deleted()
    {
        var id = Body(await _controller.Create(Request(), CancellationToken.None)).GetProperty("id").GetGuid();
        var integration = new Integration { Id = Guid.NewGuid(), PluginId = "seedpool", Payload = "{}", ProxyId = id };
        await _integrations.AddAsync(integration, CancellationToken.None);

        var result = await _controller.Delete(id, CancellationToken.None);

        result.ShouldBeOfType<ConflictObjectResult>();
        var body = Body(result);
        body.GetProperty("error").GetString().ShouldStartWith("Proxy 'vpn' is used by 1 integration(s).");
        var used = body.GetProperty("integrations").EnumerateArray().ShouldHaveSingleItem();
        used.GetProperty("id").GetGuid().ShouldBe(integration.Id);
        used.GetProperty("name").GetString().ShouldBe("seedpool");
        (await _proxies.GetByIdAsync(id, CancellationToken.None)).ShouldNotBeNull();

        integration.ProxyId = null;
        await _integrations.UpdateAsync(integration, CancellationToken.None);
        (await _controller.Delete(id, CancellationToken.None)).ShouldBeOfType<NoContentResult>();
        (await _proxies.ListAsync(CancellationToken.None)).ShouldBeEmpty();
    }

    [Fact]
    public async Task List_should_be_ordered_by_name()
    {
        await _controller.Create(Request(name: "b"), CancellationToken.None);
        await _controller.Create(Request(name: "a"), CancellationToken.None);

        var names = Body(await _controller.List(CancellationToken.None)).EnumerateArray()
            .Select(proxy => proxy.GetProperty("name").GetString());

        names.ShouldBe(["a", "b"]);
    }

    [Fact]
    public async Task Test_should_reject_an_invalid_proxy_and_an_unknown_id()
    {
        var invalid = await _controller.Test(new ProxyTestRequest(null, Request(port: 0)), CancellationToken.None);
        invalid.ShouldBeOfType<BadRequestObjectResult>();

        var unknown = await _controller.Test(new ProxyTestRequest(Guid.NewGuid(), Request()), CancellationToken.None);
        unknown.ShouldBeOfType<NotFoundResult>();
    }
}
