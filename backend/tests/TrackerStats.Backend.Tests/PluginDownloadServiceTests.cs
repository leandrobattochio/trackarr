using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;
using TrackerStats.Domain.Entities;
using TrackerStats.Domain.Plugins.Yaml;
using TrackerStats.Domain.Repositories;
using TrackerStats.Infrastructure.Plugins.Source;
using TrackerStats.Infrastructure.Plugins.Storage;
using TrackerStats.Infrastructure.Plugins.Yaml;

namespace TrackerStats.Backend.Tests;

public sealed class PluginDownloadServiceTests : IDisposable
{
    private static readonly string[] ChangelogVersions = ["1.0.0", "1.1.0", "1.2.0", "2.0.0"];

    private readonly string _root = Path.Combine(Path.GetTempPath(), $"trackerstats-download-{Guid.NewGuid():N}");
    private readonly string _sourceDirectory;
    private readonly PluginStorageLayout _layout;
    private readonly PluginStateStore _stateStore;
    private readonly InMemoryIntegrationRepository _integrations = new();

    public PluginDownloadServiceTests()
    {
        _sourceDirectory = Path.Combine(_root, "source");
        _layout = PluginStorageLayout.ForDataDirectory(Path.Combine(_root, "data"));
        _stateStore = new PluginStateStore(_layout);
    }

    [Fact]
    public async Task S1_fresh_install_should_replace_the_image_snapshot_with_the_latest_index()
    {
        WriteFile(PluginOrigin.Official, "asc", PluginYaml("asc", "1.0.0"));
        Publish(("asc", "1.1.0"), ("seedpool", "1.0.0"));

        var report = await RunAsync();

        report.Succeeded.ShouldBeTrue(report.Error);
        report.Source.ShouldBe(SourceUrl);
        report.IndexSha256.ShouldBe(PluginStateStore.ComputeFileSha256(Path.Combine(_sourceDirectory, "index.json")));
        Outcome(report, "asc").ShouldBe(PluginDownloadOutcome.Updated);
        Outcome(report, "seedpool").ShouldBe(PluginDownloadOutcome.Installed);
        ReadOfficial("asc").ShouldBe(SourceFile("asc"));
        ReadOfficial("seedpool").ShouldBe(SourceFile("seedpool"));

        var state = _stateStore.Load();
        state.Official["asc"].ShouldBe(new OfficialPluginState("1.1.0", PluginStateStore.ComputeSha256(SourceFile("asc"))));
        state.Official["seedpool"].Version.ShouldBe("1.0.0");
        state.Index!.Sha256.ShouldBe(report.IndexSha256);
        state.Index.Plugins.Keys.ShouldBe(["asc", "seedpool"], ignoreOrder: true);
        state.LastDownload!.CompletedAt.ShouldBe(report.CompletedAt);
        state.LastDownload.IndexSha256.ShouldBe(report.IndexSha256);
        state.LastDownload.Plugins.ShouldBe(report.Plugins, "persisted for the About tab");
        state.Updates.ShouldBeEmpty("a first download is not an update");
        Effective().Select(plugin => (plugin.PluginId, plugin.Origin, plugin.IsValid))
            .ShouldBe([("asc", PluginOrigin.Official, true), ("seedpool", PluginOrigin.Official, true)]);
    }

    [Fact]
    public async Task S2_fresh_install_without_internet_should_keep_the_snapshot_and_report_the_error()
    {
        var snapshot = WriteFile(PluginOrigin.Official, "asc", PluginYaml("asc", "1.0.0"));

        var report = await RunAsync();

        report.Succeeded.ShouldBeFalse();
        report.Error!.ShouldContain("Could not fetch");
        report.Plugins.ShouldBeEmpty();
        ReadOfficial("asc").ShouldBe(snapshot);
        var state = _stateStore.Load();
        state.LastDownload!.Error.ShouldBe(report.Error);
        state.Index.ShouldBeNull();
        state.Official.ShouldBeEmpty();
        Effective().ShouldHaveSingleItem().IsValid.ShouldBeTrue();
    }

    [Fact]
    public async Task S3_restart_with_nothing_new_should_change_nothing()
    {
        Publish(("asc", "1.0.0"), ("seedpool", "1.0.0"));
        await RunAsync();
        var files = SnapshotFiles(_layout.OfficialDirectory);
        var before = _stateStore.Load();

        var report = await RunAsync();

        report.Plugins.Select(plugin => plugin.Outcome).ShouldAllBe(outcome => outcome == PluginDownloadOutcome.Unchanged);
        SnapshotFiles(_layout.OfficialDirectory).ShouldBe(files);
        var after = _stateStore.Load();
        after.Official.ShouldBe(before.Official);
        after.Updates.ShouldBeEmpty();
        after.LastUpdateId.ShouldBe(0);
    }

    [Fact]
    public async Task S4_new_version_without_override_should_replace_the_file_and_record_it_for_whats_new()
    {
        Publish(("asc", "1.0.0"), ("seedpool", "1.0.0"));
        await RunAsync();
        Publish(("asc", "1.1.0"), ("seedpool", "1.0.0"));

        var report = await RunAsync();

        Outcome(report, "asc").ShouldBe(PluginDownloadOutcome.Updated);
        Outcome(report, "seedpool").ShouldBe(PluginDownloadOutcome.Unchanged);
        ReadOfficial("asc").ShouldBe(SourceFile("asc"));
        var state = _stateStore.Load();
        state.Official["asc"].Version.ShouldBe("1.1.0");
        var update = state.Updates.ShouldHaveSingleItem();
        update.Id.ShouldBe(1);
        update.PluginId.ShouldBe("asc");
        update.FromVersion.ShouldBe("1.0.0");
        update.ToVersion.ShouldBe("1.1.0");
        update.Changelog.Select(entry => entry.Version).ShouldBe(["1.1.0"]);
        update.AppliedAt.ShouldBe(state.LastDownload!.CompletedAt);

        Publish(("asc", "1.2.0"), ("seedpool", "1.0.0"));
        await RunAsync();
        await RunAsync();

        state = _stateStore.Load();
        state.Updates.Select(record => (record.Id, record.ToVersion)).ShouldBe([(1L, "1.1.0"), (2L, "1.2.0")]);
        state.LastUpdateId.ShouldBe(2);
    }

    [Fact]
    public async Task S5_new_version_with_override_should_keep_the_override_and_mark_it_outdated()
    {
        Publish(("asc", "1.0.0"));
        await RunAsync();
        var overrideContent = CreateOverride("asc");

        var unchanged = await RunAsync();

        Result(unchanged, "asc").ShouldBe(new PluginDownloadPluginResult("asc", "1.0.0", PluginDownloadOutcome.Unchanged, Overridden: true));

        Publish(("asc", "1.1.0"));
        var report = await RunAsync();

        Result(report, "asc").ShouldBe(new PluginDownloadPluginResult(
            "asc", "1.1.0", PluginDownloadOutcome.Updated, Overridden: true, Outdated: true));
        ReadOfficial("asc").ShouldBe(SourceFile("asc"), "the official copy is still downloaded");
        File.ReadAllBytes(_layout.GetPluginPath(PluginOrigin.Override, "asc")).ShouldBe(overrideContent);
        _stateStore.Load().Updates.ShouldBeEmpty("the user still runs the override");
        var effective = Effective().ShouldHaveSingleItem();
        effective.Origin.ShouldBe(PluginOrigin.Override);
    }

    [Fact]
    public async Task S14_plugin_removed_upstream_with_override_should_be_orphan_and_keep_working()
    {
        Publish(("asc", "1.0.0"), ("seedpool", "1.0.0"));
        await RunAsync();
        var overrideContent = CreateOverride("asc");
        Publish(("seedpool", "1.0.0"));

        var report = await RunAsync();

        Result(report, "asc").Outcome.ShouldBe(PluginDownloadOutcome.Orphan);
        Result(report, "asc").Overridden.ShouldBeTrue();
        File.ReadAllBytes(_layout.GetPluginPath(PluginOrigin.Override, "asc")).ShouldBe(overrideContent);
        _stateStore.Load().Index!.Plugins.ShouldNotContainKey("asc");
        var asc = Effective().Single(plugin => plugin.PluginId == "asc");
        asc.Origin.ShouldBe(PluginOrigin.Override);
        asc.IsValid.ShouldBeTrue();
    }

    [Fact]
    public async Task S15_plugin_removed_upstream_used_by_an_integration_should_be_deprecated_and_keep_working()
    {
        Publish(("asc", "1.0.0"), ("seedpool", "1.0.0"));
        await RunAsync();
        var cached = ReadOfficial("asc");
        _integrations.Seed(new Integration { Id = Guid.NewGuid(), PluginId = "asc", Payload = "{}" });
        Publish(("seedpool", "1.0.0"));

        var report = await RunAsync();

        Outcome(report, "asc").ShouldBe(PluginDownloadOutcome.Deprecated);
        ReadOfficial("asc").ShouldBe(cached);
        var state = _stateStore.Load();
        state.Official.ShouldContainKey("asc");
        state.Index!.Plugins.ShouldNotContainKey("asc");
        Effective().Single(plugin => plugin.PluginId == "asc").IsValid.ShouldBeTrue();
    }

    [Fact]
    public async Task S16_plugin_removed_upstream_and_unused_should_disappear()
    {
        Publish(("asc", "1.0.0"), ("seedpool", "1.0.0"));
        await RunAsync();
        _integrations.Seed(new Integration { Id = Guid.NewGuid(), PluginId = "seedpool", Payload = "{}" });
        Publish(("seedpool", "1.0.0"));

        var report = await RunAsync();

        Outcome(report, "asc").ShouldBe(PluginDownloadOutcome.Removed);
        File.Exists(_layout.GetPluginPath(PluginOrigin.Official, "asc")).ShouldBeFalse();
        _stateStore.Load().Official.Keys.ShouldBe(["seedpool"]);
        Effective().Select(plugin => plugin.PluginId).ShouldBe(["seedpool"]);
    }

    [Fact]
    public async Task S17_new_version_needing_a_newer_schema_should_keep_the_previous_version()
    {
        Publish(("asc", "1.0.0"));
        await RunAsync();
        var previous = ReadOfficial("asc");
        Publish(("asc", "2.0.0", 3));

        var report = await RunAsync();

        var result = Result(report, "asc");
        result.Outcome.ShouldBe(PluginDownloadOutcome.Incompatible);
        result.Version.ShouldBe("2.0.0");
        result.Message.ShouldStartWith("Update trackarr to receive asc 2.0.0");
        ReadOfficial("asc").ShouldBe(previous);
        var state = _stateStore.Load();
        state.Official["asc"].Version.ShouldBe("1.0.0");
        state.Index!.Plugins["asc"].SchemaVersion.ShouldBe(3);
        state.Updates.ShouldBeEmpty();
        Effective().ShouldHaveSingleItem().IsValid.ShouldBeTrue();
    }

    [Fact]
    public async Task S18_new_plugin_needing_a_newer_schema_should_not_be_installed()
    {
        Publish(("asc", "1.0.0", 1), ("newcomer", "1.0.0", 3));

        var report = await RunAsync();

        Outcome(report, "asc").ShouldBe(PluginDownloadOutcome.Installed);
        Result(report, "newcomer").Outcome.ShouldBe(PluginDownloadOutcome.Incompatible);
        Result(report, "newcomer").Message.ShouldStartWith("Update trackarr to receive newcomer 1.0.0");
        File.Exists(_layout.GetPluginPath(PluginOrigin.Official, "newcomer")).ShouldBeFalse();
        var state = _stateStore.Load();
        state.Official.ShouldNotContainKey("newcomer");
        state.Index!.Plugins["newcomer"].SchemaVersion.ShouldBe(3);
    }

    [Fact]
    public async Task S21_official_plugin_with_a_custom_plugin_id_should_leave_the_custom_winning()
    {
        Publish(("asc", "1.0.0"));
        await RunAsync();
        var custom = WriteFile(PluginOrigin.Custom, "mine", PluginYaml("mine", "0.1.0", displayName: "My custom"));
        Publish(("asc", "1.0.0"), ("mine", "1.0.0"));

        var report = await RunAsync();

        Result(report, "mine").ShouldBe(new PluginDownloadPluginResult(
            "mine", "1.0.0", PluginDownloadOutcome.Installed, HiddenByCustom: true));
        File.ReadAllBytes(_layout.GetPluginPath(PluginOrigin.Custom, "mine")).ShouldBe(custom);
        ReadOfficial("mine").ShouldBe(SourceFile("mine"));
        var mine = Effective().Single(plugin => plugin.PluginId == "mine");
        mine.Origin.ShouldBe(PluginOrigin.Custom);
        mine.DisplayName.ShouldBe("My custom");

        Publish(("asc", "1.0.0"), ("mine", "1.1.0"));
        await RunAsync();

        _stateStore.Load().Updates.ShouldBeEmpty("the hidden official plugin is not in use");
        File.ReadAllBytes(_layout.GetPluginPath(PluginOrigin.Custom, "mine")).ShouldBe(custom);
    }

    [Fact]
    public async Task S23_file_whose_sha256_differs_from_the_index_should_be_rejected_and_the_previous_one_kept()
    {
        Publish(("asc", "1.0.0"), ("seedpool", "1.0.0"));
        await RunAsync();
        var previous = ReadOfficial("asc");
        Publish(("asc", "1.1.0"), ("seedpool", "1.1.0"));
        File.AppendAllText(Path.Combine(_sourceDirectory, "plugins", "asc.yaml"), "# tampered\n");

        var report = await RunAsync();

        report.Succeeded.ShouldBeTrue();
        var asc = Result(report, "asc");
        asc.Outcome.ShouldBe(PluginDownloadOutcome.Failed);
        asc.Message!.ShouldContain("does not match the index");
        Outcome(report, "seedpool").ShouldBe(PluginDownloadOutcome.Updated);
        ReadOfficial("asc").ShouldBe(previous);
        var state = _stateStore.Load();
        state.Official["asc"].Version.ShouldBe("1.0.0");
        state.LastDownload!.Plugins.Single(plugin => plugin.PluginId == "asc").Message.ShouldBe(asc.Message);
        state.Updates.Select(update => update.PluginId).ShouldBe(["seedpool"]);
    }

    [Theory]
    [InlineData("malformed")]
    [InlineData("unreachable")]
    public async Task S24_malformed_or_unreachable_index_should_keep_everything_on_disk(string failure)
    {
        Publish(("asc", "1.0.0"), ("seedpool", "1.0.0"));
        await RunAsync();
        var files = SnapshotFiles(_layout.PluginsRoot, exclude: _layout.StateFilePath);
        var before = _stateStore.Load();
        Publish(("asc", "1.1.0"));
        if (failure == "malformed")
            File.WriteAllText(Path.Combine(_sourceDirectory, "index.json"), """{"plugins": [ {"id": "asc" """);
        else
            Directory.Delete(_sourceDirectory, recursive: true);

        var report = await RunAsync();

        report.Succeeded.ShouldBeFalse();
        report.Error.ShouldNotBeNullOrWhiteSpace();
        SnapshotFiles(_layout.PluginsRoot, exclude: _layout.StateFilePath).ShouldBe(files);
        var after = _stateStore.Load();
        after.Official.ShouldBe(before.Official);
        after.Index!.Sha256.ShouldBe(before.Index!.Sha256);
        after.LastDownload!.Error.ShouldBe(report.Error);
    }

    [Fact]
    public async Task Download_should_never_write_overrides_or_custom_plugins()
    {
        Publish(("asc", "1.0.0"), ("seedpool", "1.0.0"), ("mine", "1.0.0"));
        await RunAsync();
        CreateOverride("asc");
        CreateOverride("seedpool");
        WriteFile(PluginOrigin.Custom, "mine", PluginYaml("mine", "0.1.0"));
        WriteFile(PluginOrigin.Custom, "other", PluginYaml("other", "0.1.0"));
        _integrations.Seed(new Integration { Id = Guid.NewGuid(), PluginId = "seedpool", Payload = "{}" });
        var protectedFiles = SnapshotFiles(_layout.OverridesDirectory)
            .Concat(SnapshotFiles(_layout.CustomDirectory))
            .ToList();

        var sources = new List<Action>
        {
            () => Publish(("asc", "1.1.0"), ("seedpool", "1.1.0"), ("mine", "1.1.0"), ("other", "1.0.0")),
            () => Publish(("asc", "2.0.0", 2), ("seedpool", "2.0.0", 2), ("mine", "2.0.0", 2), ("other", "2.0.0", 2)),
            () =>
            {
                Publish(("asc", "1.2.0"), ("seedpool", "1.2.0"), ("mine", "1.2.0"), ("other", "1.2.0"));
                foreach (var path in Directory.GetFiles(Path.Combine(_sourceDirectory, "plugins")))
                    File.AppendAllText(path, "# tampered\n");
            },
            () => Publish(),
            () => File.WriteAllText(Path.Combine(_sourceDirectory, "index.json"), "not json"),
            () => Directory.Delete(_sourceDirectory, recursive: true),
            () => Publish(("asc", "1.2.0"), ("seedpool", "1.2.0"), ("mine", "1.2.0"), ("other", "1.2.0"))
        };

        foreach (var publish in sources)
        {
            publish();
            await RunAsync();

            SnapshotFiles(_layout.OverridesDirectory)
                .Concat(SnapshotFiles(_layout.CustomDirectory))
                .ToList()
                .ShouldBe(protectedFiles);
        }

        var state = _stateStore.Load();
        state.Overrides.Keys.ShouldBe(["asc", "seedpool"], ignoreOrder: true);
    }

    [Fact]
    public async Task S12_adopted_official_file_should_be_restored_by_the_next_download_with_its_base_copy()
    {
        Publish(("asc", "1.0.0"), ("seedpool", "1.0.0"));
        await RunAsync();
        var original = ReadOfficial("asc");
        var edited = WriteFile(PluginOrigin.Official, "asc", PluginYaml("asc", "1.0.0", displayName: "Edited on disk"));
        new PluginOverrideService(_layout, _stateStore, new PluginBaseStore(_layout), NullLogger<PluginOverrideService>.Instance)
            .AdoptLocallyModifiedOfficials().ShouldBe(["asc"]);

        var report = await RunAsync();

        Result(report, "asc").Overridden.ShouldBeTrue();
        ReadOfficial("asc").ShouldBe(original);
        File.ReadAllBytes(_layout.GetPluginPath(PluginOrigin.Override, "asc")).ShouldBe(edited);
        File.ReadAllBytes(_layout.GetOverrideBasePath("asc")).ShouldBe(original);
        _stateStore.Load().Overrides["asc"].BaseVersion.ShouldBe("1.0.0");
        _stateStore.Load().Updates.ShouldBeEmpty();
        Effective().Single(plugin => plugin.PluginId == "asc").Origin.ShouldBe(PluginOrigin.Override);
    }

    [Fact]
    public async Task Official_file_edited_on_disk_should_not_be_overwritten_or_deleted()
    {
        Publish(("asc", "1.0.0"), ("seedpool", "1.0.0"));
        await RunAsync();
        var edited = WriteFile(PluginOrigin.Official, "asc", PluginYaml("asc", "1.0.0", displayName: "Edited on disk"));
        Publish(("asc", "1.1.0"), ("seedpool", "1.0.0"));

        var report = await RunAsync();

        Outcome(report, "asc").ShouldBe(PluginDownloadOutcome.LocallyModified);
        ReadOfficial("asc").ShouldBe(edited);
        _stateStore.Load().Official["asc"].Version.ShouldBe("1.0.0");

        Publish(("seedpool", "1.0.0"));
        report = await RunAsync();

        Outcome(report, "asc").ShouldBe(PluginDownloadOutcome.LocallyModified);
        ReadOfficial("asc").ShouldBe(edited);
    }

    [Fact]
    public async Task Downloaded_file_that_fails_validation_should_be_rejected()
    {
        Publish(("asc", "1.0.0"));
        await RunAsync();
        var previous = ReadOfficial("asc");
        PublishContent(("asc", "1.1.0", 1, "pluginId: asc\ndisplayName: Broken\nversion: 1.1.0\nschemaVersion: 1\n"));

        var report = await RunAsync();

        var asc = Result(report, "asc");
        asc.Outcome.ShouldBe(PluginDownloadOutcome.Failed);
        asc.Message.ShouldStartWith("Rejected plugins/asc.yaml:");
        ReadOfficial("asc").ShouldBe(previous);
        Directory.GetFiles(_layout.OfficialDirectory).Select(Path.GetFileName).ShouldBe(["asc.yaml"]);
    }

    [Fact]
    public async Task Index_whose_file_declares_another_id_should_be_rejected()
    {
        PublishContent(("asc", "1.0.0", 1, PluginYaml("seedpool", "1.0.0")));

        var report = await RunAsync();

        Result(report, "asc").Outcome.ShouldBe(PluginDownloadOutcome.Failed);
        Result(report, "asc").Message!.ShouldContain("declares pluginId 'seedpool'");
        Directory.Exists(_layout.OfficialDirectory).ShouldBeFalse();
    }

    [Fact]
    public async Task Empty_index_should_fail_and_keep_every_installed_plugin()
    {
        Publish(("asc", "1.0.0"));
        await RunAsync();
        Publish();

        var report = await RunAsync();

        report.Error!.ShouldContain("lists no plugins");
        File.Exists(_layout.GetPluginPath(PluginOrigin.Official, "asc")).ShouldBeTrue();
        new PluginStateStore(_layout).Load().Official.Keys.ShouldBe(["asc"]);
    }

    [Fact]
    public async Task Removed_plugin_should_be_kept_when_integration_usage_cannot_be_checked()
    {
        Publish(("asc", "1.0.0"), ("seedpool", "1.0.0"));
        await RunAsync();
        Publish(("seedpool", "1.0.0"));
        var services = new ServiceCollection()
            .AddScoped<IIntegrationRepository>(_ => throw new InvalidOperationException("database is down"))
            .BuildServiceProvider();

        var report = await CreateService(services).RunAsync();

        Outcome(report, "asc").ShouldBe(PluginDownloadOutcome.Deprecated);
        File.Exists(_layout.GetPluginPath(PluginOrigin.Official, "asc")).ShouldBeTrue();
    }

    [Fact]
    public async Task Startup_service_should_not_block_host_start_and_should_persist_the_result()
    {
        var release = new TaskCompletionSource<HttpResponseMessage>(TaskCreationOptions.RunContinuationsAsynchronously);
        var handler = new PendingHttpMessageHandler(release.Task);
        var service = CreateService(httpHandler: handler, sourceUrl: "https://plugins.example.test/");
        using var hosted = new PluginStartupDownloadService(service, NullLogger<PluginStartupDownloadService>.Instance);

        await hosted.StartAsync(CancellationToken.None).WaitAsync(TimeSpan.FromSeconds(5));

        await handler.Started.WaitAsync(TimeSpan.FromSeconds(5));
        hosted.ExecuteTask!.IsCompleted.ShouldBeFalse("the download is still waiting for the source");
        release.SetResult(new HttpResponseMessage(HttpStatusCode.ServiceUnavailable));
        await hosted.ExecuteTask.WaitAsync(TimeSpan.FromSeconds(5));
        _stateStore.Load().LastDownload!.Error!.ShouldContain("HTTP 503");
        await hosted.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task Startup_service_should_log_and_swallow_unexpected_failures()
    {
        Directory.CreateDirectory(_layout.PluginsRoot);
        File.WriteAllText(_layout.StateFilePath, "{ broken");
        using var hosted = new PluginStartupDownloadService(CreateService(), NullLogger<PluginStartupDownloadService>.Instance);

        await hosted.StartAsync(CancellationToken.None);
        await hosted.ExecuteTask!.WaitAsync(TimeSpan.FromSeconds(5));

        hosted.ExecuteTask.IsCompletedSuccessfully.ShouldBeTrue();
        File.ReadAllText(_layout.StateFilePath).ShouldBe("{ broken");
    }

    private string SourceUrl => new Uri(_sourceDirectory).AbsoluteUri;

    private Task<PluginDownloadReport> RunAsync() => CreateService().RunAsync();

    private PluginDownloadService CreateService(
        IServiceProvider? services = null,
        HttpMessageHandler? httpHandler = null,
        string? sourceUrl = null)
    {
        services ??= new ServiceCollection().AddSingleton<IIntegrationRepository>(_integrations).BuildServiceProvider();
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { [PluginIndexClient.SourceUrlKey] = sourceUrl ?? SourceUrl })
            .Build();
        var client = new PluginIndexClient(
            configuration,
            new StubHttpClientFactory(httpHandler ?? new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.NotFound))),
            NullLogger<PluginIndexClient>.Instance);
        return new PluginDownloadService(
            client,
            _layout,
            _stateStore,
            new PluginBaseStore(_layout),
            new PluginOverrideService(_layout, _stateStore, new PluginBaseStore(_layout), NullLogger<PluginOverrideService>.Instance),
            services.GetRequiredService<IServiceScopeFactory>(),
            NullLogger<PluginDownloadService>.Instance);
    }

    private IReadOnlyList<LoadedYamlPluginDefinition> Effective() =>
        new YamlPluginDefinitionLoader(_layout, new PluginBaseStore(_layout), new FakeApplicationSettingsService()).LoadDefinitions();

    private void Publish(params (string Id, string Version)[] plugins) =>
        PublishContent(plugins.Select(plugin => (plugin.Id, plugin.Version, 1, PluginYaml(plugin.Id, plugin.Version))).ToArray());

    private void Publish(params (string Id, string Version, int SchemaVersion)[] plugins) =>
        PublishContent(plugins
            .Select(plugin => (plugin.Id, plugin.Version, plugin.SchemaVersion, PluginYaml(plugin.Id, plugin.Version, plugin.SchemaVersion)))
            .ToArray());

    private void Publish() => PublishContent();

    private void PublishContent(params (string Id, string Version, int SchemaVersion, string Content)[] plugins)
    {
        var pluginsDirectory = Path.Combine(_sourceDirectory, "plugins");
        if (Directory.Exists(pluginsDirectory))
            Directory.Delete(pluginsDirectory, recursive: true);
        Directory.CreateDirectory(pluginsDirectory);

        var entries = plugins.Select(plugin =>
        {
            var bytes = Encoding.UTF8.GetBytes(plugin.Content);
            File.WriteAllBytes(Path.Combine(pluginsDirectory, $"{plugin.Id}.yaml"), bytes);
            return new
            {
                id = plugin.Id,
                version = plugin.Version,
                schemaVersion = plugin.SchemaVersion,
                path = $"plugins/{plugin.Id}.yaml",
                sha256 = PluginStateStore.ComputeSha256(bytes),
                changelog = ChangelogVersions
                    .Where(version => PluginSchema.CompareVersions(version, plugin.Version) <= 0)
                    .Select(version => new { version, date = "2026-11-07", notes = $"Release {version}." })
            };
        });
        File.WriteAllText(Path.Combine(_sourceDirectory, "index.json"), JsonSerializer.Serialize(new { plugins = entries }));
    }

    private byte[] SourceFile(string pluginId) => File.ReadAllBytes(Path.Combine(_sourceDirectory, "plugins", $"{pluginId}.yaml"));

    private byte[] ReadOfficial(string pluginId) => File.ReadAllBytes(_layout.GetPluginPath(PluginOrigin.Official, pluginId));

    private byte[] WriteFile(PluginOrigin origin, string pluginId, string content)
    {
        Directory.CreateDirectory(_layout.GetDirectory(origin));
        var bytes = Encoding.UTF8.GetBytes(content);
        File.WriteAllBytes(_layout.GetPluginPath(origin, pluginId), bytes);
        return bytes;
    }

    private byte[] CreateOverride(string pluginId)
    {
        var official = _stateStore.Load().Official[pluginId];
        Directory.CreateDirectory(_layout.OverridesDirectory);
        File.Copy(_layout.GetPluginPath(PluginOrigin.Official, pluginId), _layout.GetOverrideBasePath(pluginId));
        _stateStore.Update(state => state.Overrides[pluginId] = new OverridePluginState(official.Version, official.Sha256));
        return WriteFile(PluginOrigin.Override, pluginId, PluginYaml(pluginId, official.Version, displayName: "Mine"));
    }

    private static List<(string Path, string Sha256, DateTime Modified)> SnapshotFiles(string directory, string? exclude = null) =>
        Directory.Exists(directory)
            ? Directory.GetFiles(directory, "*", SearchOption.AllDirectories)
                .Where(path => path != exclude)
                .Order(StringComparer.Ordinal)
                .Select(path => (path, PluginStateStore.ComputeFileSha256(path), File.GetLastWriteTimeUtc(path)))
                .ToList()
            : [];

    private static PluginDownloadPluginResult Result(PluginDownloadReport report, string pluginId) =>
        report.Plugins.Single(plugin => plugin.PluginId == pluginId);

    private static PluginDownloadOutcome Outcome(PluginDownloadReport report, string pluginId) =>
        Result(report, pluginId).Outcome;

    private static string PluginYaml(string pluginId, string version, int schemaVersion = 1, string? displayName = null) => $"""
        # {pluginId} {version}
        pluginId: {pluginId}
        displayName: {displayName ?? $"Plugin {pluginId}"}
        version: {version}
        schemaVersion: {schemaVersion}
        baseUrls:
          - https://tracker.test/
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
              format: text

        """;

    public void Dispose()
    {
        if (Directory.Exists(_root))
            Directory.Delete(_root, recursive: true);
    }

    private sealed class PendingHttpMessageHandler(Task<HttpResponseMessage> response) : HttpMessageHandler
    {
        private readonly TaskCompletionSource _started = new(TaskCreationOptions.RunContinuationsAsynchronously);

        public Task Started => _started.Task;

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            _started.TrySetResult();
            return await response.WaitAsync(cancellationToken);
        }
    }
}
