using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Shouldly;

namespace TrackerStats.Api.EndToEndTests;

[Trait("Database", "Sqlite")]
public sealed class SqliteProxyEndToEndTests(SqliteApiEndToEndFactory factory)
    : ProxyEndToEndTests(factory), IClassFixture<SqliteApiEndToEndFactory>;

[Trait("Database", "Postgres")]
public sealed class PostgresProxyEndToEndTests(PostgresApiEndToEndFactory factory)
    : ProxyEndToEndTests(factory), IClassFixture<PostgresApiEndToEndFactory>;

public abstract class ProxyEndToEndTests(ApiEndToEndFactory factory)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [Fact]
    public async Task Proxies_should_be_stored_without_ever_returning_their_password()
    {
        using var client = factory.CreateClient();

        var created = await CreateProxyAsync(client, "http", 3128, name: $"office-{Guid.NewGuid():N}");

        created.GetProperty("hasPassword").GetBoolean().ShouldBeTrue();
        created.TryGetProperty("password", out _).ShouldBeFalse();

        var list = await client.GetFromJsonAsync<JsonElement>("/api/proxies", JsonOptions);
        var listed = list.EnumerateArray().Single(proxy => proxy.GetProperty("id").GetGuid() == created.GetProperty("id").GetGuid());
        listed.GetProperty("type").GetString().ShouldBe("http");
        listed.TryGetProperty("password", out _).ShouldBeFalse();
        (await client.GetStringAsync("/api/proxies")).ShouldNotContain("proxy-secret");
    }

    [Fact]
    public async Task Sync_and_plugin_test_should_reach_the_tracker_only_through_an_http_proxy()
    {
        await using var proxy = new TestHttpProxy("alice", "proxy-secret");
        using var client = factory.CreateClient();
        await EnsureTrackerPluginAsync(client);
        var proxyId = (await CreateProxyAsync(client, "http", proxy.Port)).GetProperty("id").GetGuid();
        var integrationId = await CreateIntegrationAsync(client, proxyId: null);

        var direct = await SyncAsync(client, integrationId);
        direct.GetProperty("lastSyncResult").GetString().ShouldBe("unknownError");

        await SetProxyAsync(client, integrationId, proxyId);
        var proxied = await SyncAsync(client, integrationId);

        proxied.GetProperty("lastSyncResult").GetString().ShouldBe("success");
        proxied.GetProperty("stats").GetProperty("ratio").GetDecimal().ShouldBe(3.0m);
        proxied.GetProperty("stats").GetProperty("uploadedBytes").GetInt64().ShouldBe(3000);
        proxy.Requests.ShouldContain($"{FakeTracker.BaseUrl}api/user?api_token={FakeTracker.ApiKey}");

        var test = await client.PostAsJsonAsync("/api/plugins/test", new { integrationId, useOfficial = false, yaml = FakeTracker.PluginYaml });
        test.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await test.Content.ReadFromJsonAsync<JsonElement>(JsonOptions)).GetProperty("outcome").GetString().ShouldBe("success");
    }

    [Fact]
    public async Task Sync_should_reach_the_tracker_through_a_socks5_proxy_with_remote_dns()
    {
        await using var proxy = new TestSocks5Proxy("bob", "proxy-secret");
        using var client = factory.CreateClient();
        await EnsureTrackerPluginAsync(client);
        var proxyId = (await CreateProxyAsync(client, "socks5", proxy.Port, username: "bob")).GetProperty("id").GetGuid();
        var integrationId = await CreateIntegrationAsync(client, proxyId);

        var synced = await SyncAsync(client, integrationId);

        synced.GetProperty("lastSyncResult").GetString().ShouldBe("success");
        synced.GetProperty("proxyId").GetGuid().ShouldBe(proxyId);
        proxy.Requests.ShouldContain($"{FakeTracker.Host}:80/api/user?api_token={FakeTracker.ApiKey}");
    }

    [Fact]
    public async Task A_wrong_password_should_fail_the_sync_and_the_proxy_test()
    {
        await using var proxy = new TestSocks5Proxy("bob", "proxy-secret");
        using var client = factory.CreateClient();
        await EnsureTrackerPluginAsync(client);
        var proxyId = (await CreateProxyAsync(client, "socks5", proxy.Port, username: "bob", password: "wrong")).GetProperty("id").GetGuid();
        var integrationId = await CreateIntegrationAsync(client, proxyId);

        (await SyncAsync(client, integrationId)).GetProperty("lastSyncResult").GetString().ShouldBe("unknownError");

        var test = await TestProxyAsync(client, proxyId, "socks5", proxy.Port, "bob", password: null);
        test.GetProperty("success").GetBoolean().ShouldBeFalse();
        test.GetProperty("error").GetString().ShouldNotBeNullOrWhiteSpace();
        proxy.Requests.ShouldBeEmpty();
    }

    [Fact]
    public async Task The_proxy_test_should_use_the_stored_password_when_none_is_sent()
    {
        await using var proxy = new TestHttpProxy("alice", "proxy-secret");
        using var client = factory.CreateClient();
        var proxyId = (await CreateProxyAsync(client, "http", proxy.Port)).GetProperty("id").GetGuid();

        var test = await TestProxyAsync(client, proxyId, "http", proxy.Port, "alice", password: null);

        test.GetProperty("success").GetBoolean().ShouldBeTrue();
        test.GetProperty("statusCode").GetInt32().ShouldBe(200);
        proxy.Requests.ShouldHaveSingleItem();
    }

    [Fact]
    public async Task A_proxy_in_use_should_not_be_deleted_until_no_integration_uses_it()
    {
        using var client = factory.CreateClient();
        await EnsureTrackerPluginAsync(client);
        var proxyId = (await CreateProxyAsync(client, "socks5", 1080)).GetProperty("id").GetGuid();
        var integrationId = await CreateIntegrationAsync(client, proxyId);

        var blocked = await client.DeleteAsync($"/api/proxies/{proxyId}");

        blocked.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var conflict = await blocked.Content.ReadFromJsonAsync<JsonElement>(JsonOptions);
        conflict.GetProperty("integrations").EnumerateArray()
            .ShouldContain(integration => integration.GetProperty("id").GetGuid() == integrationId);

        await SetProxyAsync(client, integrationId, null);
        (await client.DeleteAsync($"/api/proxies/{proxyId}")).StatusCode.ShouldBe(HttpStatusCode.NoContent);
    }

    private static async Task EnsureTrackerPluginAsync(HttpClient client)
    {
        var plugins = await client.GetStringAsync("/api/plugins");
        if (plugins.Contains("\"proxied-tracker\""))
            return;

        var response = await client.PostAsync("/api/plugins", new StringContent(FakeTracker.PluginYaml, Encoding.UTF8, "text/plain"));
        response.StatusCode.ShouldBe(HttpStatusCode.Created, await response.Content.ReadAsStringAsync());
    }

    private static async Task<JsonElement> CreateProxyAsync(
        HttpClient client, string type, int port, string? name = null, string username = "alice", string password = "proxy-secret")
    {
        var response = await client.PostAsJsonAsync("/api/proxies", new
        {
            name = name ?? $"proxy-{Guid.NewGuid():N}",
            type,
            host = "127.0.0.1",
            port,
            username,
            password
        });
        response.StatusCode.ShouldBe(HttpStatusCode.Created, await response.Content.ReadAsStringAsync());
        return await response.Content.ReadFromJsonAsync<JsonElement>(JsonOptions);
    }

    private static async Task<JsonElement> TestProxyAsync(
        HttpClient client, Guid id, string type, int port, string username, string? password)
    {
        var response = await client.PostAsJsonAsync("/api/proxies/test", new
        {
            id,
            proxy = new { name = "probe", type, host = "127.0.0.1", port, username, password }
        });
        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        return await response.Content.ReadFromJsonAsync<JsonElement>(JsonOptions);
    }

    private static string Payload() => JsonSerializer.Serialize(new Dictionary<string, string>
    {
        ["baseUrl"] = FakeTracker.BaseUrl,
        ["apiKey"] = FakeTracker.ApiKey,
        ["required_ratio"] = "1.0",
        ["cron"] = "0 0 1 1 *"
    });

    private static async Task<Guid> CreateIntegrationAsync(HttpClient client, Guid? proxyId)
    {
        var response = await client.PostAsJsonAsync("/api/integrations", new { pluginId = "proxied-tracker", payload = Payload(), proxyId });
        response.StatusCode.ShouldBe(HttpStatusCode.Created, await response.Content.ReadAsStringAsync());
        return (await response.Content.ReadFromJsonAsync<JsonElement>(JsonOptions)).GetProperty("id").GetGuid();
    }

    private static async Task SetProxyAsync(HttpClient client, Guid integrationId, Guid? proxyId)
    {
        var response = await client.PutAsJsonAsync($"/api/integrations/{integrationId}",
            new { pluginId = "proxied-tracker", payload = Payload(), proxyId });
        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
    }

    private static async Task<JsonElement> SyncAsync(HttpClient client, Guid integrationId)
    {
        var response = await client.PostAsync($"/api/integrations/{integrationId}/sync", null);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        return await response.Content.ReadFromJsonAsync<JsonElement>(JsonOptions);
    }
}
