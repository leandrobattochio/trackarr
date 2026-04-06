using Microsoft.Extensions.Configuration;
using Shouldly;
using TrackerStats.Infrastructure.Plugins.Yaml;

namespace TrackerStats.Backend.Tests;

public sealed class YamlPluginDefinitionLoaderTests : IDisposable
{
    private static readonly FakeApplicationSettingsService SettingsService = new();
    private readonly string _rootDirectory = Path.Combine(Path.GetTempPath(), $"trackerstats-loader-{Guid.NewGuid():N}");

    public YamlPluginDefinitionLoaderTests()
    {
        Directory.CreateDirectory(_rootDirectory);
    }

    [Fact]
    public void LoadDefinitions_should_load_from_app_base_directory_when_plugins_directory_is_not_configured()
    {
        var pluginsDirectory = AppContext.BaseDirectory;
        var path = Path.Combine(pluginsDirectory, "base-plugin.yaml");
        var originalContent = File.Exists(path) ? File.ReadAllText(path) : null;
        var hadOriginal = File.Exists(path);
        File.WriteAllText(path, """
            pluginId: base-plugin
            displayName: Base Plugin
            fields: []
            steps:
              - name: profile
                method: GET
                url: /
                responseType: html
            dashboard:
              metrics:
                - stat: ratio
                  label: Ratio
            """);
        var configuration = new ConfigurationBuilder().Build();
        var loader = new YamlPluginDefinitionLoader(configuration, SettingsService);

        try
        {
            var definitions = loader.LoadDefinitions();

            definitions.ShouldContain(definition => definition.PluginId == "base-plugin" && definition.IsValid);
        }
        finally
        {
            if (hadOriginal)
            {
                File.WriteAllText(path, originalContent!);
            }
            else if (File.Exists(path))
            {
                File.Delete(path);
            }
        }
    }

    [Fact]
    public void LoadDefinitions_should_return_empty_when_directory_does_not_exist()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Plugins:Directory"] = Path.Combine(_rootDirectory, "missing")
            })
            .Build();
        var loader = new YamlPluginDefinitionLoader(configuration, SettingsService);

        loader.LoadDefinitions().ShouldBeEmpty();
    }

    [Fact]
    public void LoadDefinitions_should_report_invalid_yaml_with_fallback_metadata()
    {
        var pluginsDirectory = Path.Combine(_rootDirectory, "plugins");
        Directory.CreateDirectory(pluginsDirectory);
        File.WriteAllText(Path.Combine(pluginsDirectory, "broken-name.yaml"), """
            pluginId: broken-id
            displayName: Broken Plugin
            fields:
              - name: baseUrl
                label: Base URL
            """);
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Plugins:Directory"] = pluginsDirectory
            })
            .Build();
        var loader = new YamlPluginDefinitionLoader(configuration, SettingsService);

        var definitions = loader.LoadDefinitions();

        definitions.Count.ShouldBe(1);
        definitions[0].PluginId.ShouldBe("broken-id");
        definitions[0].DisplayName.ShouldBe("Broken Plugin");
        definitions[0].IsValid.ShouldBeFalse();
        definitions[0].Error.ShouldNotBeNull();
    }

    [Fact]
    public void LoadDefinitions_should_fall_back_to_filename_when_yaml_scalars_are_missing()
    {
        var pluginsDirectory = Path.Combine(_rootDirectory, "plugins-fallback");
        Directory.CreateDirectory(pluginsDirectory);
        File.WriteAllText(Path.Combine(pluginsDirectory, "fallback.yaml"), "pluginId:\ndisplayName:\nfields:\n  - name: baseUrl\n");
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Plugins:Directory"] = pluginsDirectory
            })
            .Build();
        var loader = new YamlPluginDefinitionLoader(configuration, SettingsService);

        var definitions = loader.LoadDefinitions();

        definitions.Count.ShouldBe(1);
        definitions[0].PluginId.ShouldBe("fallback");
        definitions[0].DisplayName.ShouldBe("fallback");
        definitions[0].IsValid.ShouldBeFalse();
    }

    [Fact]
    public void LoadDefinitions_should_resolve_relative_plugins_directory_from_content_root()
    {
        var contentRoot = Path.Combine(_rootDirectory, "content-root");
        var pluginsDirectory = Path.Combine(contentRoot, "plugins");
        Directory.CreateDirectory(pluginsDirectory);
        File.WriteAllText(Path.Combine(pluginsDirectory, "dev-plugin.yaml"), """
            pluginId: dev-plugin
            displayName: Development Plugin
            fields: []
            steps:
              - name: profile
                method: GET
                url: /
                responseType: html
            dashboard:
              metrics:
                - stat: ratio
                  label: Ratio
            """);
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Plugins:Directory"] = "plugins"
            })
            .Build();
        var loader = new YamlPluginDefinitionLoader(configuration, SettingsService, new FakeHostEnvironment(contentRoot));

        var definitions = loader.LoadDefinitions();

        definitions.Count.ShouldBe(1);
        definitions[0].PluginId.ShouldBe("dev-plugin");
    }

    public void Dispose()
    {
        if (Directory.Exists(_rootDirectory))
            Directory.Delete(_rootDirectory, recursive: true);
    }
}
