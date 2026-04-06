using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;
using TrackerStats.Domain.Plugins;
using TrackerStats.Domain.Plugins.Yaml;
using TrackerStats.Infrastructure.Plugins.Yaml;
using TrackerStats.PluginEngine;

namespace TrackerStats.PluginEngine.IntegrationTests;

public class YamlTrackerPluginIntegrationTests
{
    [Fact]
    public void ConfigureHttpClient_should_apply_interpolated_base_url_and_headers()
    {
        var definition = new PluginDefinition
        {
            PluginId = "plugin",
            DisplayName = "Plugin",
            Dashboard = new DashboardConfig
            {
                Metrics =
                [
                    new DashboardMetricDefinition
                    {
                        Stat = "ratio",
                        Label = "Ratio"
                    }
                ]
            },
            Http = new HttpConfig
            {
                BaseUrl = "{{baseUrl}}",
                Headers = new Dictionary<string, string>
                {
                    ["Accept"] = "application/json",
                    ["Cookie"] = "session={{cookie}}"
                },
                Cookies = new Dictionary<string, string>
                {
                    ["theme"] = "{{theme}}"
                }
            }
        };
        PluginDefinitionDefaults.ApplyDefaults(definition, "test-user-agent");

        var plugin = new YamlTrackerPlugin(
            definition,
            new YamlPluginEngine(
                NullLogger<YamlPluginEngine>.Instance,
                [],
                [],
                new TemplateInterpolator(),
                new AuthFailureDetector(),
                new ResultMapper()),
            new TemplateInterpolator(),
            new PluginConfiguration(new Dictionary<string, string?>
            {
                ["baseUrl"] = "https://tracker.test/",
                ["cookie"] = "abc123",
                ["theme"] = "dark"
            }));

        using var httpClient = new HttpClient();

        plugin.ConfigureHttpClient(httpClient);

        httpClient.BaseAddress.ShouldBe(new Uri("https://tracker.test/"));
        httpClient.DefaultRequestHeaders.Accept.ToString().ShouldContain("application/json");
        httpClient.DefaultRequestHeaders.GetValues("Cookie").ShouldContain("session=abc123");
        httpClient.DefaultRequestHeaders.GetValues("Cookie").ShouldContain("theme=dark");
    }

    [Fact]
    public void AuthMode_should_reflect_declared_plugin_fields()
    {
        var cookiePlugin = CreatePluginWithField("cookie");
        var apiKeyPlugin = CreatePluginWithField("apiKey");
        var usernamePasswordPlugin = CreatePluginWithField("username");

        cookiePlugin.AuthMode.ShouldBe(AuthMode.Cookie);
        apiKeyPlugin.AuthMode.ShouldBe(AuthMode.ApiKey);
        usernamePasswordPlugin.AuthMode.ShouldBe(AuthMode.UsernamePassword);
    }

    private static YamlTrackerPlugin CreatePluginWithField(string fieldName)
    {
        var definition = new PluginDefinition
        {
            PluginId = fieldName,
            DisplayName = fieldName,
            Dashboard = new DashboardConfig
            {
                Metrics =
                [
                    new DashboardMetricDefinition
                    {
                        Stat = "ratio",
                        Label = "Ratio"
                    }
                ]
            },
            Fields =
            [
                new FieldDefinition
                {
                    Name = fieldName,
                    Label = fieldName,
                    Required = true
                }
            ]
        };

        return new YamlTrackerPlugin(
            definition,
            new YamlPluginEngine(
                NullLogger<YamlPluginEngine>.Instance,
                [],
                [],
                new TemplateInterpolator(),
                new AuthFailureDetector(),
                new ResultMapper()),
            new TemplateInterpolator());
    }
}
