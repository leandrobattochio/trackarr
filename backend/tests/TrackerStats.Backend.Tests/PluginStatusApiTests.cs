using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;
using TrackerStats.Api.Controllers;
using TrackerStats.Domain.Entities;
using TrackerStats.Domain.Plugins;
using TrackerStats.Domain.Plugins.Yaml;
using TrackerStats.Infrastructure.Plugins.Source;
using TrackerStats.Infrastructure.Plugins.Storage;
using TrackerStats.Infrastructure.Plugins.Yaml;

namespace TrackerStats.Backend.Tests;

public sealed class PluginStatusApiTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), $"trackerstats-status-{Guid.NewGuid():N}");
    private readonly PluginStorageLayout _layout;
    private readonly PluginStateStore _stateStore;
    private readonly YamlPluginDefinitionLoader _loader;
    private readonly InMemoryIntegrationRepository _integrations = new();

    public PluginStatusApiTests()
    {
        _layout = PluginStorageLayout.ForDataDirectory(_root);
        _stateStore = new PluginStateStore(_layout);
        _loader = new YamlPluginDefinitionLoader(_layout, new PluginBaseStore(_layout), new FakeApplicationSettingsService());
    }

    public void Dispose()
    {
        if (Directory.Exists(_root))
            Directory.Delete(_root, recursive: true);
    }

    [Fact]
    public async Task An_official_plugin_should_report_its_versions_and_no_flags()
    {
        InstallOfficial("asc", "1.2.0");
        SetIndex(("asc", "1.2.0", 1, null));

        var asc = await GetStatusAsync("asc");

        asc.GetProperty("origin").GetString().ShouldBe("official");
        asc.GetProperty("version").GetString().ShouldBe("1.2.0");
        asc.GetProperty("baseVersion").ValueKind.ShouldBe(JsonValueKind.Null);
        asc.GetProperty("latestOfficialVersion").GetString().ShouldBe("1.2.0");
        asc.GetProperty("definitionValid").GetBoolean().ShouldBeTrue();
        foreach (var flag in Flags)
            asc.GetProperty(flag).GetBoolean().ShouldBeFalse(flag);
        asc.GetProperty("requiredAppVersion").ValueKind.ShouldBe(JsonValueKind.Null);
    }

    [Fact]
    public async Task S5_an_override_whose_base_is_older_than_the_official_should_be_outdated()
    {
        InstallOfficial("asc", "1.1.0");
        WriteOverride("asc", "1.0.0", "Mine");
        SetIndex(("asc", "1.1.0", 1, null));

        var asc = await GetStatusAsync("asc");

        asc.GetProperty("origin").GetString().ShouldBe("override");
        asc.GetProperty("version").GetString().ShouldBe("1.0.0");
        asc.GetProperty("baseVersion").GetString().ShouldBe("1.0.0");
        asc.GetProperty("latestOfficialVersion").GetString().ShouldBe("1.1.0");
        asc.GetProperty("outdated").GetBoolean().ShouldBeTrue();
        asc.GetProperty("orphan").GetBoolean().ShouldBeFalse();
    }

    [Fact]
    public async Task An_override_on_the_current_official_version_should_not_be_outdated()
    {
        InstallOfficial("asc", "1.1.0");
        WriteOverride("asc", "1.1.0", "Mine");
        SetIndex(("asc", "1.1.0", 1, null));

        var asc = await GetStatusAsync("asc");

        asc.GetProperty("origin").GetString().ShouldBe("override");
        asc.GetProperty("outdated").GetBoolean().ShouldBeFalse();
    }

    [Fact]
    public async Task An_override_should_not_be_outdated_by_a_newer_version_it_cannot_install()
    {
        InstallOfficial("asc", "1.0.0");
        WriteOverride("asc", "1.0.0", "Mine");
        SetIndex(("asc", "2.0.0", 3, null));

        var asc = await GetStatusAsync("asc");

        asc.GetProperty("outdated").GetBoolean().ShouldBeFalse();
        asc.GetProperty("incompatible").GetBoolean().ShouldBeTrue();
    }

    [Fact]
    public async Task S14_an_override_of_a_plugin_removed_from_the_index_should_be_orphan()
    {
        InstallOfficial("asc", "1.0.0");
        WriteOverride("asc", "1.0.0", "Mine");
        SetIndex(("seedpool", "1.0.0", 1, null));

        var asc = await GetStatusAsync("asc");

        asc.GetProperty("orphan").GetBoolean().ShouldBeTrue();
        asc.GetProperty("deprecated").GetBoolean().ShouldBeFalse();
    }

    [Fact]
    public async Task S15_a_cached_official_plugin_removed_from_the_index_should_be_deprecated()
    {
        InstallOfficial("asc", "1.0.0");
        SetIndex(("seedpool", "1.0.0", 1, null));

        var asc = await GetStatusAsync("asc");

        asc.GetProperty("deprecated").GetBoolean().ShouldBeTrue();
        asc.GetProperty("orphan").GetBoolean().ShouldBeFalse();
    }

    [Fact]
    public async Task Without_a_downloaded_index_nothing_should_be_orphan_or_deprecated()
    {
        InstallOfficial("asc", "1.0.0");
        InstallOfficial("seedpool", "1.0.0");
        WriteOverride("seedpool", "1.0.0", "Mine");

        var plugins = await ListAsync();

        plugins.ShouldAllBe(plugin => !plugin.GetProperty("orphan").GetBoolean() && !plugin.GetProperty("deprecated").GetBoolean());
    }

    [Fact]
    public async Task S17_a_newer_official_version_needing_a_newer_schema_should_be_incompatible()
    {
        InstallOfficial("asc", "1.0.0");
        SetIndex(("asc", "1.1.0", 3, "0.5.0"));

        var asc = await GetStatusAsync("asc");

        asc.GetProperty("definitionValid").GetBoolean().ShouldBeTrue();
        asc.GetProperty("version").GetString().ShouldBe("1.0.0");
        asc.GetProperty("latestOfficialVersion").GetString().ShouldBe("1.0.0");
        asc.GetProperty("incompatible").GetBoolean().ShouldBeTrue();
        asc.GetProperty("incompatibleVersion").GetString().ShouldBe("1.1.0");
        asc.GetProperty("requiredSchemaVersion").GetInt32().ShouldBe(3);
        asc.GetProperty("requiredAppVersion").GetString().ShouldBe("0.5.0");
        asc.GetProperty("incompatibleMessage").GetString().ShouldBe(PluginSchema.GetUpdateRequiredMessage("asc", "1.1.0", 3));
    }

    [Fact]
    public async Task S18_a_new_official_id_needing_a_newer_schema_should_be_listed_as_incompatible()
    {
        SetIndex(("future", "1.0.0", 3, null));

        var future = await GetStatusAsync("future");

        future.GetProperty("origin").GetString().ShouldBe("official");
        future.GetProperty("displayName").GetString().ShouldBe("future");
        future.GetProperty("definitionValid").GetBoolean().ShouldBeFalse();
        future.GetProperty("definitionError").GetString().ShouldBe(PluginSchema.GetUpdateRequiredMessage("future", "1.0.0", 3));
        future.GetProperty("version").ValueKind.ShouldBe(JsonValueKind.Null);
        future.GetProperty("incompatible").GetBoolean().ShouldBeTrue();
        future.GetProperty("incompatibleVersion").GetString().ShouldBe("1.0.0");
        future.GetProperty("requiredSchemaVersion").GetInt32().ShouldBe(3);
        future.GetProperty("requiredAppVersion").ValueKind.ShouldBe(JsonValueKind.Null);
        future.GetProperty("fields").GetArrayLength().ShouldBe(0);
    }

    [Fact]
    public async Task A_compatible_index_entry_that_is_not_installed_should_not_be_listed()
    {
        SetIndex(("asc", "1.0.0", 1, null));

        (await ListAsync()).ShouldBeEmpty();
    }

    [Fact]
    public async Task A_custom_file_needing_a_newer_schema_should_be_incompatible()
    {
        WritePlugin(PluginOrigin.Custom, "mine", PluginYaml("mine", "1.0.0", schemaVersion: 3));

        var mine = await GetStatusAsync("mine");

        mine.GetProperty("origin").GetString().ShouldBe("custom");
        mine.GetProperty("definitionValid").GetBoolean().ShouldBeFalse();
        mine.GetProperty("version").GetString().ShouldBe("1.0.0");
        mine.GetProperty("incompatible").GetBoolean().ShouldBeTrue();
        mine.GetProperty("requiredSchemaVersion").GetInt32().ShouldBe(3);
    }

    [Fact]
    public async Task A_custom_should_ignore_an_incompatible_official_with_its_id()
    {
        WritePlugin(PluginOrigin.Custom, "asc", PluginYaml("asc", "1.0.0"));
        SetIndex(("asc", "2.0.0", 3, null));

        var asc = await GetStatusAsync("asc");

        asc.GetProperty("incompatible").GetBoolean().ShouldBeFalse();
        asc.GetProperty("hiddenOfficial").GetBoolean().ShouldBeTrue();
    }

    [Fact]
    public async Task S21_a_custom_with_an_official_id_in_the_index_should_report_hidden_official()
    {
        InstallOfficial("asc", "1.0.0");
        WritePlugin(PluginOrigin.Custom, "asc", PluginYaml("asc", "0.1.0", displayName: "My ASC"));
        WritePlugin(PluginOrigin.Custom, "mine", PluginYaml("mine", "0.1.0"));
        SetIndex(("asc", "1.0.0", 1, null));

        var plugins = await ListAsync();

        var asc = plugins.Single(plugin => plugin.GetProperty("pluginId").GetString() == "asc");
        asc.GetProperty("origin").GetString().ShouldBe("custom");
        asc.GetProperty("displayName").GetString().ShouldBe("My ASC");
        asc.GetProperty("hiddenOfficial").GetBoolean().ShouldBeTrue();
        asc.GetProperty("latestOfficialVersion").GetString().ShouldBe("1.0.0");
        asc.GetProperty("deprecated").GetBoolean().ShouldBeFalse();
        plugins.Single(plugin => plugin.GetProperty("pluginId").GetString() == "mine")
            .GetProperty("hiddenOfficial").GetBoolean().ShouldBeFalse();
    }

    [Fact]
    public async Task A_custom_with_an_official_id_known_only_from_the_index_should_report_hidden_official()
    {
        WritePlugin(PluginOrigin.Custom, "asc", PluginYaml("asc", "0.1.0"));
        SetIndex(("asc", "1.0.0", 1, null));

        (await GetStatusAsync("asc")).GetProperty("hiddenOfficial").GetBoolean().ShouldBeTrue();
    }

    [Theory]
    [InlineData(PluginProcessResult.AuthFailed, true)]
    [InlineData(PluginProcessResult.UnknownError, true)]
    [InlineData(PluginProcessResult.Success, false)]
    [InlineData(null, false)]
    public async Task LastSyncFailed_should_follow_the_integrations_last_sync(PluginProcessResult? lastSync, bool expected)
    {
        InstallOfficial("asc", "1.0.0");
        InstallOfficial("seedpool", "1.0.0");
        SeedIntegration("asc", PluginProcessResult.Success);
        SeedIntegration("asc", lastSync);
        SeedIntegration("seedpool", PluginProcessResult.AuthFailed);

        (await GetStatusAsync("asc")).GetProperty("lastSyncFailed").GetBoolean().ShouldBe(expected);
    }

    [Fact]
    public async Task Diff_of_an_outdated_override_should_return_base_yours_latest_and_the_changelog_since_base()
    {
        var baseYaml = PluginYaml("asc", "1.0.0");
        File.WriteAllText(WritePluginPath(PluginOrigin.Official, "asc"), baseYaml);
        await SaveOverrideThroughApiAsync("asc", PluginYaml("asc", "1.0.0", displayName: "Mine"));
        var yours = File.ReadAllText(_layout.GetPluginPath(PluginOrigin.Override, "asc"));
        var latest = InstallOfficial("asc", "1.2.0");
        SetIndex(("asc", "1.2.0", 1, null));

        var diff = GetDiff("asc");

        diff.GetProperty("origin").GetString().ShouldBe("override");
        diff.GetProperty("baseVersion").GetString().ShouldBe("1.0.0");
        diff.GetProperty("latestOfficialVersion").GetString().ShouldBe("1.2.0");
        diff.GetProperty("base").GetString().ShouldBe(baseYaml);
        diff.GetProperty("yours").GetString().ShouldBe(yours);
        diff.GetProperty("latestOfficial").GetString().ShouldBe(latest);
        diff.GetProperty("changelog").EnumerateArray().Select(item => item.GetProperty("version").GetString())
            .ShouldBe(["1.2.0", "1.1.0"]);
    }

    [Fact]
    public void Diff_of_an_adopted_override_without_a_base_copy_should_return_a_null_base()
    {
        InstallOfficial("asc", "1.1.0");
        var yours = WriteOverride("asc", "1.0.0", "Mine");

        var diff = GetDiff("asc");

        diff.GetProperty("base").ValueKind.ShouldBe(JsonValueKind.Null);
        diff.GetProperty("yours").GetString().ShouldBe(yours);
        diff.GetProperty("latestOfficial").GetString().ShouldNotBeNull();
        diff.GetProperty("changelog").GetArrayLength().ShouldBe(0);
    }

    [Fact]
    public void Diff_of_an_official_plugin_should_only_return_the_official_text()
    {
        var official = InstallOfficial("asc", "1.0.0");

        var diff = GetDiff("asc");

        diff.GetProperty("origin").GetString().ShouldBe("official");
        diff.GetProperty("base").ValueKind.ShouldBe(JsonValueKind.Null);
        diff.GetProperty("yours").ValueKind.ShouldBe(JsonValueKind.Null);
        diff.GetProperty("latestOfficial").GetString().ShouldBe(official);
    }

    [Fact]
    public void Diff_of_a_custom_hiding_an_official_should_return_both_texts()
    {
        var official = InstallOfficial("asc", "1.0.0");
        var custom = WritePlugin(PluginOrigin.Custom, "asc", PluginYaml("asc", "0.1.0"));

        var diff = GetDiff("asc");

        diff.GetProperty("origin").GetString().ShouldBe("custom");
        diff.GetProperty("yours").GetString().ShouldBe(custom);
        diff.GetProperty("latestOfficial").GetString().ShouldBe(official);
    }

    [Fact]
    public void Diff_should_return_404_for_an_unknown_plugin_and_400_for_an_invalid_id()
    {
        CreateController().GetDiff("missing").ShouldBeOfType<NotFoundObjectResult>();
        CreateController().GetDiff("../escaped").ShouldBeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public void Index_parser_should_read_an_optional_min_app_version_and_reject_an_invalid_one()
    {
        const string sha = "0000000000000000000000000000000000000000000000000000000000000000";
        static byte[] Index(string extra) => Encoding.UTF8.GetBytes(
            $$"""{"plugins":[{"id":"asc","version":"1.0.0","schemaVersion":2,"path":"plugins/asc.yaml","sha256":"{{sha}}"{{extra}}}]}""");

        PluginIndexParser.Parse(Index("")).Plugins.Single().MinAppVersion.ShouldBeNull();
        PluginIndexParser.Parse(Index(""","minAppVersion":"0.5.0" """)).Plugins.Single().MinAppVersion.ShouldBe("0.5.0");
        Should.Throw<FormatException>(() => PluginIndexParser.Parse(Index(""","minAppVersion":"next" """)))
            .Message.ShouldContain("minAppVersion");
    }

    private static readonly string[] Flags = ["outdated", "orphan", "deprecated", "incompatible", "hiddenOfficial", "lastSyncFailed"];

    private async Task<List<JsonElement>> ListAsync()
    {
        var result = await CreateController().GetAll(CancellationToken.None);
        return TestHttp.ToJson(result.ShouldBeOfType<OkObjectResult>().Value).EnumerateArray().ToList();
    }

    private async Task<JsonElement> GetStatusAsync(string pluginId) =>
        (await ListAsync()).Single(plugin => plugin.GetProperty("pluginId").GetString() == pluginId);

    private JsonElement GetDiff(string pluginId) =>
        TestHttp.ToJson(CreateController().GetDiff(pluginId).ShouldBeOfType<OkObjectResult>().Value);

    private async Task SaveOverrideThroughApiAsync(string pluginId, string yaml)
    {
        var controller = CreateController();
        TestHttp.SetYamlBody(controller, yaml);
        (await controller.Update(pluginId, CancellationToken.None)).ShouldBeOfType<OkObjectResult>();
    }

    private PluginsController CreateController() =>
        new(
            _loader,
            _layout,
            new PluginOverrideService(_layout, _stateStore, new PluginBaseStore(_layout), NullLogger<PluginOverrideService>.Instance),
            _stateStore,
            new PluginBaseStore(_layout),
            new PluginStatusService(_loader, _layout, _stateStore),
            _integrations);

    private string InstallOfficial(string pluginId, string version)
    {
        var content = PluginYaml(pluginId, version);
        File.WriteAllText(WritePluginPath(PluginOrigin.Official, pluginId), content);
        _stateStore.Update(state => state.Official[pluginId] =
            new OfficialPluginState(version, PluginStateStore.ComputeSha256(Encoding.UTF8.GetBytes(content))));
        return content;
    }

    private string WriteOverride(string pluginId, string baseVersion, string displayName)
    {
        var content = WritePlugin(PluginOrigin.Override, pluginId, PluginYaml(pluginId, baseVersion, displayName));
        _stateStore.Update(state => state.Overrides[pluginId] = new OverridePluginState(baseVersion, "unknown"));
        return content;
    }

    private void SetIndex(params (string Id, string Version, int SchemaVersion, string? MinAppVersion)[] entries)
    {
        IReadOnlyList<PluginIndexChangelogEntry> Changelog(string version) =>
        [
            new(version, "2026-11-07", $"Release {version}."),
            new("1.1.0", "2026-10-01", "Middle release."),
            new("1.0.0", "2026-09-01", "First release.")
        ];

        _stateStore.Update(state => state.Index = new PluginIndexState(
            "file:///source/",
            "index-sha",
            DateTimeOffset.UtcNow,
            entries.ToDictionary(
                entry => entry.Id,
                entry => new IndexedPluginState(entry.Version, entry.SchemaVersion, "sha", Changelog(entry.Version), entry.MinAppVersion),
                StringComparer.Ordinal)));
    }

    private void SeedIntegration(string pluginId, PluginProcessResult? lastSync) =>
        _integrations.Seed(new Integration { Id = Guid.NewGuid(), PluginId = pluginId, Payload = "{}", LastSyncResult = lastSync });

    private string WritePlugin(PluginOrigin origin, string pluginId, string content)
    {
        File.WriteAllText(WritePluginPath(origin, pluginId), content);
        return content;
    }

    private string WritePluginPath(PluginOrigin origin, string pluginId)
    {
        var path = _layout.GetPluginPath(origin, pluginId);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        return path;
    }

    private static string PluginYaml(string pluginId, string version, string? displayName = null, int schemaVersion = 1) => $"""
        pluginId: {pluginId}
        displayName: {displayName ?? pluginId.ToUpperInvariant()}
        version: {version}
        schemaVersion: {schemaVersion}
        baseUrls:
          - https://tracker.test/
        fields: []
        steps:
          - name: profile
            method: GET
            url: "/"
            responseType: html
        dashboard:
          metrics:
            - stat: ratio
              label: Ratio
        """;
}
