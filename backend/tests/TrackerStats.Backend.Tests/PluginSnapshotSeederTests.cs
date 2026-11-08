using System.Net;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;
using TrackerStats.Domain.Plugins.Yaml;
using TrackerStats.Domain.Repositories;
using TrackerStats.Infrastructure.Plugins.Source;
using TrackerStats.Infrastructure.Plugins.Storage;
using TrackerStats.Infrastructure.Plugins.Yaml;

namespace TrackerStats.Backend.Tests;

public sealed class PluginSnapshotSeederTests : IDisposable
{
    private static readonly string FixtureSource = Path.Combine(AppContext.BaseDirectory, "plugin-source");
    private static readonly string[] FixturePluginIds = ["asc", "bj-share", "fearnopeer", "seedpool"];

    private readonly string _root = Path.Combine(Path.GetTempPath(), $"trackerstats-snapshot-{Guid.NewGuid():N}");
    private readonly string _snapshotDirectory;
    private readonly PluginStorageLayout _layout;
    private readonly PluginStateStore _stateStore;

    public PluginSnapshotSeederTests()
    {
        _snapshotDirectory = Path.Combine(_root, "snapshot");
        _layout = PluginStorageLayout.ForDataDirectory(Path.Combine(_root, "data"));
        _stateStore = new PluginStateStore(_layout);
        CopyDirectory(FixtureSource, _snapshotDirectory);
    }

    public void Dispose()
    {
        if (Directory.Exists(_root))
            Directory.Delete(_root, recursive: true);
    }

    [Fact]
    public void Run_should_seed_an_empty_official_folder_and_record_state()
    {
        var seeded = CreateSeeder().Run();

        seeded.ShouldBe(FixturePluginIds, ignoreOrder: true);
        var state = _stateStore.Load();
        foreach (var pluginId in FixturePluginIds)
        {
            var snapshotFile = File.ReadAllBytes(Path.Combine(_snapshotDirectory, "plugins", $"{pluginId}.yaml"));
            File.ReadAllBytes(_layout.GetPluginPath(PluginOrigin.Official, pluginId)).ShouldBe(snapshotFile);
            state.Official[pluginId].Sha256.ShouldBe(PluginStateStore.ComputeSha256(snapshotFile));
            state.Official[pluginId].Version.ShouldBe("1.0.0");
        }

        new YamlPluginDefinitionLoader(_layout, new FakeApplicationSettingsService()).LoadDefinitions()
            .Select(plugin => (plugin.PluginId, plugin.Origin, plugin.IsValid))
            .ShouldBe(FixturePluginIds.Select(id => (id, PluginOrigin.Official, true)), ignoreOrder: true);
    }

    [Fact]
    public async Task Startup_download_from_the_same_source_should_see_the_seeded_plugins_as_unchanged()
    {
        CreateSeeder().Run();

        var report = await CreateDownloadService(new Uri(_snapshotDirectory).AbsoluteUri).RunAsync();

        report.Succeeded.ShouldBeTrue(report.Error);
        report.Plugins.Select(plugin => (plugin.PluginId, plugin.Outcome))
            .ShouldBe(FixturePluginIds.Select(id => (id, PluginDownloadOutcome.Unchanged)), ignoreOrder: true);
    }

    [Fact]
    public void Run_should_do_nothing_when_official_already_has_plugins()
    {
        Directory.CreateDirectory(_layout.OfficialDirectory);
        var existing = _layout.GetPluginPath(PluginOrigin.Official, "mine");
        File.WriteAllText(existing, "pluginId: mine\n");

        CreateSeeder().Run().ShouldBeEmpty();

        Directory.GetFiles(_layout.OfficialDirectory).ShouldBe([existing]);
        File.Exists(_layout.StateFilePath).ShouldBeFalse();
    }

    [Fact]
    public void Run_should_seed_when_only_overrides_or_customs_exist()
    {
        Directory.CreateDirectory(_layout.CustomDirectory);
        File.WriteAllText(_layout.GetPluginPath(PluginOrigin.Custom, "mine"), "pluginId: mine\n");

        CreateSeeder().Run().Count.ShouldBe(FixturePluginIds.Length);
    }

    [Fact]
    public void Run_should_do_nothing_without_a_snapshot()
    {
        Directory.Delete(_snapshotDirectory, recursive: true);

        CreateSeeder().Run().ShouldBeEmpty();

        Directory.Exists(_layout.OfficialDirectory).ShouldBeFalse();
        File.Exists(_layout.StateFilePath).ShouldBeFalse();
    }

    [Fact]
    public void Run_should_do_nothing_with_a_malformed_index()
    {
        File.WriteAllText(Path.Combine(_snapshotDirectory, "index.json"), """{"plugins": [ {"id": "asc" """);

        CreateSeeder().Run().ShouldBeEmpty();

        File.Exists(_layout.StateFilePath).ShouldBeFalse();
    }

    [Fact]
    public void Run_should_skip_files_that_do_not_match_the_index()
    {
        File.AppendAllText(Path.Combine(_snapshotDirectory, "plugins", "asc.yaml"), "# tampered\n");
        File.Delete(Path.Combine(_snapshotDirectory, "plugins", "seedpool.yaml"));

        var seeded = CreateSeeder().Run();

        seeded.ShouldBe(["bj-share", "fearnopeer"], ignoreOrder: true);
        File.Exists(_layout.GetPluginPath(PluginOrigin.Official, "asc")).ShouldBeFalse();
        _stateStore.Load().Official.Keys.ShouldBe(["bj-share", "fearnopeer"], ignoreOrder: true);
    }

    [Fact]
    public void Run_should_skip_plugins_with_an_unsupported_schema_version()
    {
        var indexPath = Path.Combine(_snapshotDirectory, "index.json");
        var index = JsonNode.Parse(File.ReadAllText(indexPath))!;
        foreach (var entry in index["plugins"]!.AsArray().Where(entry => (string?)entry!["id"] == "asc"))
            entry!["schemaVersion"] = PluginSchema.SupportedPluginSchemaVersion + 1;
        File.WriteAllText(indexPath, index.ToJsonString());

        var seeded = CreateSeeder().Run();

        seeded.ShouldNotContain("asc");
        seeded.Count.ShouldBe(FixturePluginIds.Length - 1);
    }

    private PluginSnapshotSeeder CreateSeeder() =>
        new(
            new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?> { [PluginSnapshotSeeder.SnapshotDirectoryKey] = _snapshotDirectory })
                .Build(),
            _layout,
            _stateStore,
            NullLogger<PluginSnapshotSeeder>.Instance);

    private PluginDownloadService CreateDownloadService(string sourceUrl)
    {
        var services = new ServiceCollection()
            .AddSingleton<IIntegrationRepository>(new InMemoryIntegrationRepository())
            .BuildServiceProvider();
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { [PluginIndexClient.SourceUrlKey] = sourceUrl })
            .Build();
        var client = new PluginIndexClient(
            configuration,
            new StubHttpClientFactory(new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.NotFound))),
            NullLogger<PluginIndexClient>.Instance);
        return new PluginDownloadService(
            client,
            _layout,
            _stateStore,
            new PluginOverrideService(_layout, _stateStore, NullLogger<PluginOverrideService>.Instance),
            services.GetRequiredService<IServiceScopeFactory>(),
            NullLogger<PluginDownloadService>.Instance);
    }

    private static void CopyDirectory(string source, string target)
    {
        foreach (var path in Directory.GetFiles(source, "*", SearchOption.AllDirectories))
        {
            var destination = Path.Combine(target, Path.GetRelativePath(source, path));
            Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
            File.Copy(path, destination);
        }
    }
}
