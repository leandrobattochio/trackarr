using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Shouldly;
using TrackerStats.Domain.Plugins.Yaml;
using TrackerStats.Infrastructure.Plugins.Storage;

namespace TrackerStats.Backend.Tests;

public sealed class PluginStorageTests : IDisposable
{
    private readonly string _rootDirectory = Path.Combine(Path.GetTempPath(), $"trackerstats-storage-{Guid.NewGuid():N}");

    [Fact]
    public void Layout_should_default_data_directory_to_slash_data()
    {
        var layout = new PluginStorageLayout(new ConfigurationBuilder().Build());

        layout.DataDirectory.ShouldBe(Path.GetFullPath("/data"));
        layout.PluginsRoot.ShouldBe(Path.Combine(Path.GetFullPath("/data"), "plugins"));
    }

    [Fact]
    public void Layout_should_place_folders_and_state_under_data_directory_plugins()
    {
        var layout = new PluginStorageLayout(Configuration(_rootDirectory));

        var pluginsRoot = Path.Combine(_rootDirectory, "plugins");
        layout.DataDirectory.ShouldBe(_rootDirectory);
        layout.OfficialDirectory.ShouldBe(Path.Combine(pluginsRoot, "official"));
        layout.OverridesDirectory.ShouldBe(Path.Combine(pluginsRoot, "overrides"));
        layout.CustomDirectory.ShouldBe(Path.Combine(pluginsRoot, "custom"));
        layout.StateFilePath.ShouldBe(Path.Combine(pluginsRoot, "state.json"));
        layout.GetPluginPath(PluginOrigin.Override, "asc").ShouldBe(Path.Combine(pluginsRoot, "overrides", "asc.yaml"));
        layout.GetOverrideBasePath("asc").ShouldBe(Path.Combine(pluginsRoot, "overrides", "asc.base.yaml"));
    }

    [Fact]
    public void Layout_should_resolve_relative_data_directory_from_content_root()
    {
        var layout = new PluginStorageLayout(Configuration("data"), new FakeHostEnvironment(_rootDirectory));

        layout.DataDirectory.ShouldBe(Path.Combine(_rootDirectory, "data"));
    }

    [Theory]
    [InlineData("../escaped")]
    [InlineData("a/b")]
    [InlineData("Upper")]
    [InlineData("")]
    public void Layout_should_refuse_paths_for_invalid_plugin_ids(string pluginId)
    {
        var layout = PluginStorageLayout.ForDataDirectory(_rootDirectory);

        Should.Throw<ArgumentException>(() => layout.GetPluginPath(PluginOrigin.Custom, pluginId));
        Should.Throw<ArgumentException>(() => layout.GetOverrideBasePath(pluginId));
    }

    [Fact]
    public void StateStore_should_return_empty_state_when_file_is_missing()
    {
        var state = CreateStore().Load();

        state.Official.ShouldBeEmpty();
        state.Overrides.ShouldBeEmpty();
    }

    [Fact]
    public void StateStore_should_round_trip_official_and_override_entries()
    {
        var store = CreateStore();

        store.Update(state =>
        {
            state.Official["asc"] = new OfficialPluginState("1.2.0", "aa");
            state.Overrides["asc"] = new OverridePluginState("1.1.0", "bb");
        });

        var loaded = CreateStore().Load();
        loaded.Official["asc"].ShouldBe(new OfficialPluginState("1.2.0", "aa"));
        loaded.Overrides["asc"].ShouldBe(new OverridePluginState("1.1.0", "bb"));
    }

    [Fact]
    public void StateStore_should_write_camel_case_json_at_plugins_root()
    {
        var store = CreateStore();

        store.Save(new PluginState { Official = { ["asc"] = new OfficialPluginState("1.0.0", "cc") } });

        var layout = PluginStorageLayout.ForDataDirectory(_rootDirectory);
        using var document = JsonDocument.Parse(File.ReadAllText(layout.StateFilePath));
        var asc = document.RootElement.GetProperty("official").GetProperty("asc");
        asc.GetProperty("version").GetString().ShouldBe("1.0.0");
        asc.GetProperty("sha256").GetString().ShouldBe("cc");
        document.RootElement.GetProperty("overrides").EnumerateObject().ShouldBeEmpty();
        File.Exists($"{layout.StateFilePath}.tmp").ShouldBeFalse();
    }

    [Fact]
    public void StateStore_should_report_malformed_json()
    {
        var layout = PluginStorageLayout.ForDataDirectory(_rootDirectory);
        Directory.CreateDirectory(layout.PluginsRoot);
        File.WriteAllText(layout.StateFilePath, "{ not json");

        var ex = Should.Throw<InvalidOperationException>(() => CreateStore().Load());

        ex.Message.ShouldContain("state.json");
    }

    [Fact]
    public void ComputeSha256_should_return_lowercase_hex()
    {
        PluginStateStore.ComputeSha256(Encoding.UTF8.GetBytes("abc"))
            .ShouldBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    }

    private PluginStateStore CreateStore() => new(PluginStorageLayout.ForDataDirectory(_rootDirectory));

    private static IConfiguration Configuration(string dataDirectory) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { [PluginStorageLayout.DataDirectoryKey] = dataDirectory })
            .Build();

    public void Dispose()
    {
        if (Directory.Exists(_rootDirectory))
            Directory.Delete(_rootDirectory, recursive: true);
    }
}
