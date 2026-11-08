using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;
using TrackerStats.Api.Controllers;
using TrackerStats.Domain.Entities;
using TrackerStats.Domain.Plugins.Yaml;
using TrackerStats.Infrastructure.Plugins;
using TrackerStats.Infrastructure.Plugins.Storage;
using TrackerStats.Infrastructure.Plugins.Yaml;
using TrackerStats.Infrastructure.Services;
using TrackerStats.PluginEngine;

namespace TrackerStats.Backend.Tests;

public sealed class PluginOverrideLifecycleTests : IDisposable
{
    private const string IntegrationPayload = """{"required_ratio":"1","baseUrl":"https://tracker.test/","cookie":"c"}""";

    private readonly string _root = Path.Combine(Path.GetTempPath(), $"trackerstats-overrides-{Guid.NewGuid():N}");
    private readonly PluginStorageLayout _layout;
    private readonly PluginStateStore _stateStore;
    private readonly PluginOverrideService _overrides;
    private readonly YamlPluginDefinitionLoader _loader;

    public PluginOverrideLifecycleTests()
    {
        _layout = PluginStorageLayout.ForDataDirectory(_root);
        _stateStore = new PluginStateStore(_layout);
        _overrides = new PluginOverrideService(_layout, _stateStore, NullLogger<PluginOverrideService>.Instance);
        _loader = new YamlPluginDefinitionLoader(_layout, new FakeApplicationSettingsService());
    }

    public void Dispose()
    {
        if (Directory.Exists(_root))
            Directory.Delete(_root, recursive: true);
    }

    [Fact]
    public async Task S10_saving_an_edited_official_plugin_should_create_an_override_with_its_base()
    {
        var official = InstallOfficial("asc", "1.2.0");
        var edited = PluginYaml("asc", "1.2.0", displayName: "Mine");

        var result = await UpdateAsync("asc", edited);

        Json(result.ShouldBeOfType<OkObjectResult>()).GetProperty("origin").GetString().ShouldBe("override");
        File.ReadAllText(OverridePath("asc")).ShouldBe(edited);
        File.ReadAllBytes(_layout.GetOverrideBasePath("asc")).ShouldBe(official);
        File.ReadAllBytes(OfficialPath("asc")).ShouldBe(official, "official/ is only written by the download");
        _stateStore.Load().Overrides["asc"].ShouldBe(new OverridePluginState("1.2.0", PluginStateStore.ComputeSha256(official)));
        var effective = Effective("asc");
        effective.Origin.ShouldBe(PluginOrigin.Override);
        effective.DisplayName.ShouldBe("Mine");
    }

    [Fact]
    public async Task S10_base_version_should_be_the_recorded_official_version()
    {
        InstallOfficial("asc", "1.2.0");
        _stateStore.Update(state => state.Official["asc"] = state.Official["asc"] with { Version = "1.2.1" });

        await UpdateAsync("asc", PluginYaml("asc", "1.2.0", displayName: "Mine"));

        _stateStore.Load().Overrides["asc"].BaseVersion.ShouldBe("1.2.1");
    }

    [Fact]
    public async Task S9_saving_an_official_plugin_unchanged_should_create_no_override()
    {
        var official = InstallOfficial("asc", "1.0.0");

        var result = await UpdateAsync("asc", Encoding.UTF8.GetString(official));

        Json(result.ShouldBeOfType<OkObjectResult>()).GetProperty("origin").GetString().ShouldBe("official");
        Directory.Exists(_layout.OverridesDirectory).ShouldBeFalse();
        _stateStore.Load().Overrides.ShouldBeEmpty();
        File.ReadAllBytes(OfficialPath("asc")).ShouldBe(official);
        Effective("asc").Origin.ShouldBe(PluginOrigin.Official);
    }

    [Fact]
    public async Task S9_formatting_comments_key_order_and_explicit_defaults_should_not_create_an_override()
    {
        InstallOfficial("asc", "1.0.0");
        var reformatted = """
            # my comment
            displayName: "Plugin asc"
            pluginId: asc
            schemaVersion: 1
            version: "1.0.0"
            baseUrls: [ "https://tracker.test/" ]
            fields:
              - { name: cookie, label: Cookie, type: text, required: true, sensitive: true }
            customFields: []
            authFailure:
              httpStatusCodes: [401, 403]
            steps:
              - name: profile
                url: /
                method: GET
                responseType: html
            dashboard:
              metrics:
                - label: Ratio
                  stat: ratio
                  format: text
            """;

        await UpdateAsync("asc", reformatted);

        Directory.Exists(_layout.OverridesDirectory).ShouldBeFalse();
        _stateStore.Load().Overrides.ShouldBeEmpty();
    }

    [Fact]
    public async Task S11_editing_an_override_back_to_its_base_should_discard_it()
    {
        var official = InstallOfficial("asc", "1.0.0");
        await UpdateAsync("asc", PluginYaml("asc", "1.0.0", displayName: "Mine"));
        File.Exists(OverridePath("asc")).ShouldBeTrue();

        var result = await UpdateAsync("asc", "# back to the original\n" + Encoding.UTF8.GetString(official));

        Json(result.ShouldBeOfType<OkObjectResult>()).GetProperty("origin").GetString().ShouldBe("official");
        File.Exists(OverridePath("asc")).ShouldBeFalse();
        File.Exists(_layout.GetOverrideBasePath("asc")).ShouldBeFalse();
        _stateStore.Load().Overrides.ShouldBeEmpty();
        Effective("asc").Origin.ShouldBe(PluginOrigin.Official);
    }

    [Fact]
    public async Task S11_an_outdated_override_should_compare_against_its_base_not_the_newer_official()
    {
        var baseBytes = InstallOfficial("asc", "1.0.0");
        await UpdateAsync("asc", PluginYaml("asc", "1.0.0", displayName: "Mine"));
        var newer = InstallOfficial("asc", "1.1.0");

        await UpdateAsync("asc", PluginYaml("asc", "1.1.0", displayName: "Mine too"));

        File.Exists(OverridePath("asc")).ShouldBeTrue("the content differs from the 1.0.0 base");
        File.ReadAllBytes(_layout.GetOverrideBasePath("asc")).ShouldBe(baseBytes);
        _stateStore.Load().Overrides["asc"].BaseVersion.ShouldBe("1.0.0");

        await UpdateAsync("asc", Encoding.UTF8.GetString(baseBytes));

        File.Exists(OverridePath("asc")).ShouldBeFalse();
        Effective("asc").RawContent.ShouldBe(Encoding.UTF8.GetString(newer));
    }

    [Fact]
    public async Task S7_use_official_should_delete_the_override_without_backup_and_apply_immediately()
    {
        InstallOfficial("asc", "1.0.0");
        await UpdateAsync("asc", PluginYaml("asc", "1.0.0", displayName: "Mine"));
        var registry = CreateRegistry();
        registry.GetById("asc")!.DisplayName.ShouldBe("Mine");

        var result = CreateController().DeleteOverride("asc");

        result.ShouldBeOfType<NoContentResult>();
        Directory.GetFiles(_layout.OverridesDirectory).ShouldBeEmpty("no backup is kept");
        _stateStore.Load().Overrides.ShouldBeEmpty();
        registry.GetById("asc")!.DisplayName.ShouldBe("Plugin asc");
    }

    [Fact]
    public void Delete_override_should_return_not_found_without_override_and_bad_request_for_invalid_ids()
    {
        InstallOfficial("asc", "1.0.0");
        var controller = CreateController();

        controller.DeleteOverride("asc").ShouldBeOfType<NotFoundObjectResult>();
        controller.DeleteOverride("..").ShouldBeOfType<BadRequestObjectResult>();
        File.Exists(OfficialPath("asc")).ShouldBeTrue();
    }

    [Fact]
    public void S12_an_official_file_edited_on_disk_should_be_moved_to_overrides_with_the_recorded_version_as_base()
    {
        var original = InstallOfficial("asc", "1.0.0");
        var untouched = InstallOfficial("seedpool", "2.0.0");
        var edited = PluginYaml("asc", "1.0.0", displayName: "Edited on disk");
        File.WriteAllText(OfficialPath("asc"), edited);

        var adopted = _overrides.AdoptLocallyModifiedOfficials();

        adopted.ShouldBe(["asc"]);
        File.Exists(OfficialPath("asc")).ShouldBeFalse();
        File.ReadAllText(OverridePath("asc")).ShouldBe(edited);
        _stateStore.Load().Overrides["asc"].ShouldBe(new OverridePluginState("1.0.0", PluginStateStore.ComputeSha256(original)));
        File.ReadAllBytes(OfficialPath("seedpool")).ShouldBe(untouched);
        Effective("asc").Origin.ShouldBe(PluginOrigin.Override);
        _overrides.AdoptLocallyModifiedOfficials().ShouldBeEmpty();
    }

    [Fact]
    public void S12_the_base_copy_should_be_restored_once_the_original_official_file_is_back()
    {
        var original = InstallOfficial("asc", "1.0.0");
        File.WriteAllText(OfficialPath("asc"), PluginYaml("asc", "1.0.0", displayName: "Edited on disk"));
        _overrides.AdoptLocallyModifiedOfficials();
        _overrides.RestoreMissingBaseCopies();
        File.Exists(_layout.GetOverrideBasePath("asc")).ShouldBeFalse("the original content is not on disk yet");

        File.WriteAllBytes(OfficialPath("asc"), original);
        _overrides.RestoreMissingBaseCopies();

        File.ReadAllBytes(_layout.GetOverrideBasePath("asc")).ShouldBe(original);
    }

    [Fact]
    public void S12_files_without_a_recorded_hash_or_with_an_existing_override_should_be_left_alone()
    {
        Directory.CreateDirectory(_layout.OfficialDirectory);
        File.WriteAllText(OfficialPath("unrecorded"), PluginYaml("unrecorded", "1.0.0"));
        InstallOfficial("asc", "1.0.0");
        var existingOverride = PluginYaml("asc", "1.0.0", displayName: "Existing override");
        Directory.CreateDirectory(_layout.OverridesDirectory);
        File.WriteAllText(OverridePath("asc"), existingOverride);
        var edited = PluginYaml("asc", "1.0.0", displayName: "Edited on disk");
        File.WriteAllText(OfficialPath("asc"), edited);

        _overrides.AdoptLocallyModifiedOfficials().ShouldBeEmpty();

        File.Exists(OfficialPath("unrecorded")).ShouldBeTrue();
        File.ReadAllText(OfficialPath("asc")).ShouldBe(edited);
        File.ReadAllText(OverridePath("asc")).ShouldBe(existingOverride);
    }

    [Fact]
    public async Task S12_saving_a_locally_modified_official_plugin_should_adopt_it_first()
    {
        var original = InstallOfficial("asc", "1.0.0");
        File.WriteAllText(OfficialPath("asc"), PluginYaml("asc", "1.0.0", displayName: "Edited on disk"));
        var saved = PluginYaml("asc", "1.0.0", displayName: "Saved in the UI");

        await UpdateAsync("asc", saved);

        File.ReadAllText(OverridePath("asc")).ShouldBe(saved);
        File.Exists(OfficialPath("asc")).ShouldBeFalse();
        _stateStore.Load().Overrides["asc"].BaseSha256.ShouldBe(PluginStateStore.ComputeSha256(original));
    }

    [Fact]
    public async Task S13_an_invalid_override_should_report_invalid_override_without_falling_back_to_the_official()
    {
        InstallOfficial("asc", "1.0.0");
        Directory.CreateDirectory(_layout.OverridesDirectory);
        File.WriteAllText(OverridePath("asc"), "pluginId: asc\ndisplayName: Broken\nsteps: [unclosed");
        var registry = CreateRegistry();
        var integration = new Integration { Id = Guid.NewGuid(), PluginId = "asc", Payload = IntegrationPayload, RequiredRatio = 1m };
        var repository = new InMemoryIntegrationRepository();
        await repository.AddAsync(integration, CancellationToken.None);
        repository.Added.Clear();
        var snapshots = new InMemoryIntegrationSnapshotRepository();
        var validator = new IntegrationConfigurationValidator(registry);
        var sync = new IntegrationSyncService(
            repository, snapshots, registry, new FakeTrackerPluginHttpClientFactory(), validator,
            NullLogger<IntegrationSyncService>.Instance);

        registry.GetById("asc").ShouldBeNull("the official version is not used as a fallback");
        registry.GetInvalidOverrideError("asc").ShouldNotBeNull();
        var validation = validator.Validate(integration);
        var outcome = await sync.SyncAsync(integration.Id, CancellationToken.None);

        validation.IsValid.ShouldBeFalse();
        validation.ErrorCode.ShouldBe(IntegrationConfigurationErrorCodes.InvalidOverride);
        validation.Error.ShouldNotBeNull().ShouldStartWith("Invalid override:");
        outcome.ConfigurationIsValid.ShouldBeFalse();
        outcome.ConfigurationErrorCode.ShouldBe(IntegrationConfigurationErrorCodes.InvalidOverride);
        outcome.Result.ShouldBeNull();
        repository.Updated.ShouldBeEmpty("the sync is skipped");
        snapshots.Added.ShouldBeEmpty();
    }

    [Fact]
    public void S13_a_missing_plugin_should_still_report_not_found()
    {
        var validation = new IntegrationConfigurationValidator(CreateRegistry()).Validate("asc", IntegrationPayload);

        validation.ErrorCode.ShouldBe(IntegrationConfigurationErrorCodes.PluginNotFound);
        validation.Error.ShouldBe("Plugin 'asc' not found.");
    }

    [Fact]
    public void Semantic_comparison_should_detect_real_changes()
    {
        var yaml = PluginYaml("asc", "1.0.0");

        PluginDefinitionComparer.AreSemanticallyEqual(yaml, "# comment\n" + yaml).ShouldBeTrue();
        PluginDefinitionComparer.AreSemanticallyEqual(yaml, PluginYaml("asc", "1.0.1")).ShouldBeFalse();
        PluginDefinitionComparer.AreSemanticallyEqual(yaml, yaml.Replace("url: /", "url: /profile")).ShouldBeFalse();
        PluginDefinitionComparer.AreSemanticallyEqual(yaml, "not: [valid").ShouldBeFalse();
        PluginDefinitionComparer.AreSemanticallyEqual("not: [valid", "not: [valid").ShouldBeFalse();
    }

    private byte[] InstallOfficial(string pluginId, string version)
    {
        Directory.CreateDirectory(_layout.OfficialDirectory);
        var bytes = Encoding.UTF8.GetBytes(PluginYaml(pluginId, version));
        File.WriteAllBytes(OfficialPath(pluginId), bytes);
        _stateStore.Update(state => state.Official[pluginId] = new OfficialPluginState(version, PluginStateStore.ComputeSha256(bytes)));
        return bytes;
    }

    private async Task<IActionResult> UpdateAsync(string pluginId, string yaml)
    {
        var controller = CreateController();
        TestHttp.SetYamlBody(controller, yaml);
        return await controller.Update(pluginId, CancellationToken.None);
    }

    private PluginsController CreateController() => new(_loader, _layout, _overrides, _stateStore, new PluginStatusService(_loader, _layout, _stateStore), new InMemoryIntegrationRepository());

    private TrackerPluginRegistry CreateRegistry() =>
        new(
            new ServiceCollection().BuildServiceProvider(),
            new YamlPluginEngine(
                new ListLogger<YamlPluginEngine>(), [], [], new TemplateInterpolator(), new AuthFailureDetector(), new ResultMapper()),
            new TemplateInterpolator(),
            _loader);

    private LoadedYamlPluginDefinition Effective(string pluginId) =>
        _loader.LoadDefinitions().Single(plugin => plugin.PluginId == pluginId);

    private string OfficialPath(string pluginId) => _layout.GetPluginPath(PluginOrigin.Official, pluginId);

    private string OverridePath(string pluginId) => _layout.GetPluginPath(PluginOrigin.Override, pluginId);

    private static System.Text.Json.JsonElement Json(OkObjectResult result) => TestHttp.ToJson(result.Value);

    private static string PluginYaml(string pluginId, string version, string? displayName = null) => $"""
        pluginId: {pluginId}
        displayName: {displayName ?? $"Plugin {pluginId}"}
        version: {version}
        schemaVersion: 1
        baseUrls:
          - https://tracker.test/
        fields:
          - name: cookie
            label: Cookie
            type: text
            required: true
            sensitive: true
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
}
