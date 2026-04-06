using Microsoft.Extensions.DependencyInjection;
using Shouldly;
using TrackerStats.Domain.Plugins;
using TrackerStats.Domain.Plugins.Yaml;
using TrackerStats.Infrastructure.Plugins;
using TrackerStats.PluginEngine;

namespace TrackerStats.Backend.Tests;

public class TrackerPluginRegistryTests
{
    [Fact]
    public void GetById_should_return_plugin_from_valid_yaml_definition()
    {
        var sut = CreateRegistry(
        [
            new LoadedYamlPluginDefinition(
                "seedpool",
                "Seedpool",
                CreateDefinition("seedpool", "Seedpool"),
                "raw",
                null)
        ]);

        var plugin = sut.GetById("seedpool");

        plugin.ShouldNotBeNull();
        plugin.PluginId.ShouldBe("seedpool");
        plugin.DisplayName.ShouldBe("Seedpool");
    }

    [Fact]
    public void CreateById_should_apply_configuration_to_created_plugin_instance()
    {
        var definition = CreateDefinition("seedpool", "Seedpool");
        PluginDefinitionDefaults.ApplyDefaults(definition);
        var sut = CreateRegistry(
        [
            new LoadedYamlPluginDefinition("seedpool", "Seedpool", definition, "raw", null)
        ]);

        var plugin = sut.CreateById("seedpool", new PluginConfiguration(new Dictionary<string, string?>
        {
            ["baseUrl"] = "https://tracker.test/",
            ["apiKey"] = "secret"
        }));
        using var httpClient = new HttpClient();

        plugin.ShouldNotBeNull();
        plugin.ConfigureHttpClient(httpClient);

        httpClient.BaseAddress.ShouldBe(new Uri("https://tracker.test/"));
    }

    [Fact]
    public void GetCatalog_should_ignore_invalid_definitions_and_include_source()
    {
        var sut = CreateRegistry(
        [
            new LoadedYamlPluginDefinition("valid", "Valid", CreateDefinition("valid", "Valid"), "raw", null),
            new LoadedYamlPluginDefinition("broken", "Broken", null, "raw", "bad yaml")
        ]);

        var catalog = sut.GetCatalog();

        catalog.Count.ShouldBe(1);
        catalog[0].PluginId.ShouldBe("valid");
    }

    [Fact]
    public void GetById_should_return_null_when_definition_is_missing()
    {
        var sut = CreateRegistry([]);

        sut.GetById("missing").ShouldBeNull();
    }

    [Fact]
    public void CreateById_should_return_null_when_definition_is_missing()
    {
        var sut = CreateRegistry([]);

        sut.CreateById("missing", new PluginConfiguration(new Dictionary<string, string?>())).ShouldBeNull();
    }

    [Fact]
    public void GetAll_should_return_plugin_instances_for_all_valid_definitions()
    {
        var sut = CreateRegistry(
        [
            new LoadedYamlPluginDefinition("one", "One", CreateDefinition("one", "One"), "raw", null),
            new LoadedYamlPluginDefinition("two", "Two", CreateDefinition("two", "Two"), "raw", null)
        ]);

        var plugins = sut.GetAll();

        plugins.Count.ShouldBe(2);
        plugins.Select(x => x.PluginId).ShouldBe(["one", "two"], ignoreOrder: true);
    }

    private static TrackerPluginRegistry CreateRegistry(IReadOnlyList<LoadedYamlPluginDefinition> definitions)
    {
        var services = new ServiceCollection().BuildServiceProvider();
        return new TrackerPluginRegistry(
            services,
            new YamlPluginEngine(
                new ListLogger<YamlPluginEngine>(),
                [],
                [],
                new TemplateInterpolator(),
                new AuthFailureDetector(),
                new ResultMapper()),
            new TemplateInterpolator(),
            new FakeYamlPluginDefinitionLoader(definitions));
    }

    private static PluginDefinition CreateDefinition(string pluginId, string displayName)
    {
        return new PluginDefinition
        {
            PluginId = pluginId,
            DisplayName = displayName,
            Fields =
            [
                new FieldDefinition
                {
                    Name = "apiKey",
                    Label = "API Key",
                    Type = "password",
                    Required = true,
                    Sensitive = true
                }
            ],
            Steps =
            [
                new StepDefinition
                {
                    Name = "user",
                    Url = "api/user?api_token={{apiKey}}",
                    ResponseType = "json"
                }
            ],
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
            }
        };
    }
}
