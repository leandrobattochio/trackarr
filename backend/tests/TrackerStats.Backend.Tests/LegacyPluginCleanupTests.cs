using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;
using TrackerStats.Infrastructure.Plugins.Storage;

namespace TrackerStats.Backend.Tests;

public sealed class LegacyPluginCleanupTests : IDisposable
{
    private readonly string _dataDirectory = Path.Combine(Path.GetTempPath(), $"trackerstats-legacy-{Guid.NewGuid():N}");
    private readonly PluginStorageLayout _layout;

    public LegacyPluginCleanupTests()
    {
        _layout = PluginStorageLayout.ForDataDirectory(_dataDirectory);
    }

    [Fact]
    public void Run_should_delete_yaml_in_legacy_folders_and_record_marker()
    {
        var rootPlugin = Write("asc.yaml");
        var templatePlugin = Write(Path.Combine("templates", "my-custom.yaml"));
        var hangfireDb = Write("hangfire.db");
        var otherFile = Write(Path.Combine("templates", "notes.yml"));
        var official = Write(Path.Combine("plugins", "official", "asc.yaml"));
        var custom = Write(Path.Combine("plugins", "custom", "mine.yaml"));

        var deleted = CreateCleanup().Run();

        deleted.ShouldBe([rootPlugin, templatePlugin], ignoreOrder: true);
        File.Exists(rootPlugin).ShouldBeFalse();
        File.Exists(templatePlugin).ShouldBeFalse();
        File.Exists(hangfireDb).ShouldBeTrue();
        File.Exists(otherFile).ShouldBeTrue();
        File.Exists(official).ShouldBeTrue();
        File.Exists(custom).ShouldBeTrue();
        new PluginStateStore(_layout).Load().LegacyCleanupCompletedAt.ShouldNotBeNull();
    }

    [Fact]
    public void Run_should_keep_yaml_files_that_are_not_plugins()
    {
        var compose = Write("docker-compose.yaml", "services:\n  trackarr:\n    image: trackarr\n");
        var plugin = Write("asc.yaml");

        CreateCleanup().Run().ShouldBe([plugin]);

        File.Exists(compose).ShouldBeTrue();
    }

    [Fact]
    public void Run_should_record_marker_when_no_legacy_folder_exists()
    {
        CreateCleanup().Run().ShouldBeEmpty();

        new PluginStateStore(_layout).Load().LegacyCleanupCompletedAt.ShouldNotBeNull();
    }

    [Fact]
    public void Run_should_delete_nothing_on_second_boot()
    {
        CreateCleanup().Run();
        var marker = new PluginStateStore(_layout).Load().LegacyCleanupCompletedAt;
        var laterFile = Write("later.yaml");

        CreateCleanup().Run().ShouldBeEmpty();

        File.Exists(laterFile).ShouldBeTrue();
        new PluginStateStore(_layout).Load().LegacyCleanupCompletedAt.ShouldBe(marker);
    }

    [Fact]
    public void Run_should_keep_existing_state_entries()
    {
        var store = new PluginStateStore(_layout);
        store.Update(state => state.Official["asc"] = new OfficialPluginState("1.0.0", "aa"));

        CreateCleanup().Run();

        store.Load().Official["asc"].ShouldBe(new OfficialPluginState("1.0.0", "aa"));
    }

    private LegacyPluginCleanup CreateCleanup() =>
        new(_layout, new PluginStateStore(_layout), NullLogger<LegacyPluginCleanup>.Instance);

    private string Write(string relativePath, string content = "pluginId: x")
    {
        var path = Path.Combine(_dataDirectory, relativePath);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, content);
        return path;
    }

    public void Dispose()
    {
        if (Directory.Exists(_dataDirectory))
            Directory.Delete(_dataDirectory, recursive: true);
    }
}
