using Microsoft.Extensions.Configuration;
using Shouldly;
using TrackerStats.Infrastructure.Plugins.Yaml;

namespace TrackerStats.Backend.Tests;

public sealed class YamlPluginDefinitionLoaderTests : IDisposable
{
    private readonly string _rootDirectory = Path.Combine(Path.GetTempPath(), $"trackerstats-loader-{Guid.NewGuid():N}");

    public YamlPluginDefinitionLoaderTests()
    {
        Directory.CreateDirectory(_rootDirectory);
    }

    [Fact]
    public void LoadDefinitions_should_load_from_database_directory_when_plugins_directory_is_not_configured()
    {
        var pluginsDirectory = Path.Combine(_rootDirectory, "data");
        Directory.CreateDirectory(pluginsDirectory);
        File.WriteAllText(Path.Combine(pluginsDirectory, "seedpool.yaml"), """
            pluginId: seedpool
            displayName: Seedpool
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
                ["Database:Directory"] = pluginsDirectory
            })
            .Build();
        var loader = new YamlPluginDefinitionLoader(configuration);

        var definitions = loader.LoadDefinitions();

        definitions.Count.ShouldBe(1);
        definitions[0].PluginId.ShouldBe("seedpool");
        definitions[0].IsValid.ShouldBeTrue();
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
        var loader = new YamlPluginDefinitionLoader(configuration);

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
        var loader = new YamlPluginDefinitionLoader(configuration);

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
        var loader = new YamlPluginDefinitionLoader(configuration);

        var definitions = loader.LoadDefinitions();

        definitions.Count.ShouldBe(1);
        definitions[0].PluginId.ShouldBe("fallback");
        definitions[0].DisplayName.ShouldBe("fallback");
        definitions[0].IsValid.ShouldBeFalse();
    }

    [Fact]
    public void LoadDefinitions_should_resolve_relative_sqlite_connection_directory()
    {
        var appBase = AppContext.BaseDirectory;
        var relativeDirectory = Path.Combine("loader-db", Guid.NewGuid().ToString("N"));
        var pluginsDirectory = Path.GetFullPath(Path.Combine(appBase, relativeDirectory));
        Directory.CreateDirectory(pluginsDirectory);
        File.WriteAllText(Path.Combine(pluginsDirectory, "tracker.yaml"), """
            pluginId: tracker
            displayName: Tracker
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
                ["ConnectionStrings:DefaultConnection"] = $"Data Source={relativeDirectory}\\trackerstats.db"
            })
            .Build();
        var loader = new YamlPluginDefinitionLoader(configuration);

        var definitions = loader.LoadDefinitions();

        definitions.Count.ShouldBe(1);
        definitions[0].PluginId.ShouldBe("tracker");
    }

    [Fact]
    public void LoadDefinitions_should_fall_back_to_app_base_directory_when_connection_string_has_no_data_source()
    {
        var pluginsDirectory = AppContext.BaseDirectory;
        var path = Path.Combine(pluginsDirectory, "base-fallback.yaml");
        File.WriteAllText(path, """
            pluginId: base-fallback
            displayName: Base Fallback
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
                ["ConnectionStrings:DefaultConnection"] = "Mode=Memory"
            })
            .Build();
        var loader = new YamlPluginDefinitionLoader(configuration);

        try
        {
            var definitions = loader.LoadDefinitions();

            definitions.ShouldContain(x => x.PluginId == "base-fallback");
        }
        finally
        {
            if (File.Exists(path))
                File.Delete(path);
        }
    }

    public void Dispose()
    {
        if (Directory.Exists(_rootDirectory))
            Directory.Delete(_rootDirectory, recursive: true);
    }
}
