using Shouldly;
using TrackerStats.Domain.Plugins;
using TrackerStats.Infrastructure.Plugins;

namespace TrackerStats.Backend.Tests;

public class TrackerPluginMiscTests
{
    [Fact]
    public void TrackerPluginHttpClientFactory_should_create_client_and_configure_plugin()
    {
        var sut = new TrackerPluginHttpClientFactory(new FakeHttpClientFactory());
        var plugin = new FakeTrackerPlugin("plugin", configureHttpClient: client =>
        {
            client.BaseAddress = new Uri("https://tracker.test/");
        });

        using var client = sut.CreateClient(plugin);

        client.BaseAddress.ShouldBe(new Uri("https://tracker.test/"));
    }

    [Fact]
    public async Task TrackerPluginBase_should_expose_configured_field_values()
    {
        var plugin = new DerivedTrackerPlugin(new PluginConfiguration(new Dictionary<string, string?>
        {
            ["username"] = "alice"
        }));

        plugin.GetValue("username").ShouldBe("alice");
        plugin.GetRequired("username").ShouldBe("alice");
        await plugin.FetchStatsAsync(new HttpClient(), CancellationToken.None);
    }

    private sealed class DerivedTrackerPlugin(PluginConfiguration configuration) : TrackerPluginBase(configuration)
    {
        public override string PluginId => "derived";
        public override string DisplayName => "Derived";
        public override AuthMode AuthMode => AuthMode.UsernamePassword;
        public override IReadOnlyList<PluginField> Fields => [];

        public string? GetValue(string fieldName) => GetFieldValue(fieldName);

        public string GetRequired(string fieldName) => GetRequiredFieldValue(fieldName);

        public override void ConfigureHttpClient(HttpClient httpClient)
        {
        }

        public override Task<TrackerFetchResult> FetchStatsAsync(HttpClient httpClient, CancellationToken ct) =>
            Task.FromResult(new TrackerFetchResult(PluginProcessResult.Success));
    }
}
