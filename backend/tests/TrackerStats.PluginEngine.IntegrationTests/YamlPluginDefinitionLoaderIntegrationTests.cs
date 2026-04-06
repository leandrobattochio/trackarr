using Microsoft.Extensions.Configuration;
using Shouldly;
using TrackerStats.Domain.Plugins.Yaml;
using TrackerStats.Infrastructure.Plugins.Yaml;

namespace TrackerStats.PluginEngine.IntegrationTests;

public class YamlPluginDefinitionLoaderIntegrationTests
{
    [Fact]
    public void LoadDefinitions_should_load_repo_plugin_files_and_apply_defaults()
    {
        var pluginsDirectory = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "plugins"));
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Plugins:Directory"] = pluginsDirectory
            })
            .Build();
        var sut = new YamlPluginDefinitionLoader(configuration);

        var definitions = sut.LoadDefinitions();

        definitions.Count.ShouldBeGreaterThanOrEqualTo(4);
        definitions.All(definition => definition.IsValid).ShouldBeTrue();
        definitions.Select(definition => definition.PluginId).ShouldContain("asc");
        definitions.Select(definition => definition.PluginId).ShouldContain("bj-share");
        definitions.Select(definition => definition.PluginId).ShouldContain("fearnopeer");
        definitions.Select(definition => definition.PluginId).ShouldContain("seedpool");

        var seedpool = definitions.Single(definition => definition.PluginId == "seedpool").Definition!;
        seedpool.Fields.Any(field => field.Name == "baseUrl").ShouldBeTrue();
        seedpool.Fields.Any(field => field.Name == "required_ratio").ShouldBeTrue();
        seedpool.Http.ShouldNotBeNull();
        seedpool.Http.BaseUrl.ShouldBe("{{baseUrl}}");
        seedpool.Http.Headers.ContainsKey("User-Agent").ShouldBeTrue();
        seedpool.AuthFailure.ShouldNotBeNull();
        seedpool.AuthFailure.HttpStatusCodes.ShouldContain(401);
        seedpool.AuthFailure.HttpStatusCodes.ShouldContain(403);
    }

    [Fact]
    public void LoadDefinitions_should_surface_invalid_plugin_files_as_error_entries()
    {
        var pluginsDirectory = Path.Combine(Path.GetTempPath(), $"trackerstats-plugin-tests-{Guid.NewGuid():N}");
        Directory.CreateDirectory(pluginsDirectory);

        try
        {
            File.WriteAllText(Path.Combine(pluginsDirectory, "broken.yaml"), """
                pluginId: broken
                displayName: Broken Plugin
                fields:
                  - name: baseUrl
                    label: Base URL
                dashboard:
                  metrics:
                    - stat: ratio
                      label: Ratio
                steps: []
                """);

            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Plugins:Directory"] = pluginsDirectory
                })
                .Build();
            var sut = new YamlPluginDefinitionLoader(configuration);

            var definitions = sut.LoadDefinitions();

            definitions.Count.ShouldBe(1);
            definitions[0].PluginId.ShouldBe("broken");
            definitions[0].IsValid.ShouldBeFalse();
            definitions[0].Definition.ShouldBeNull();
            var error = definitions[0].Error;
            error.ShouldNotBeNull();
            error.ShouldContain("engine-owned");
        }
        finally
        {
            Directory.Delete(pluginsDirectory, recursive: true);
        }
    }
}
