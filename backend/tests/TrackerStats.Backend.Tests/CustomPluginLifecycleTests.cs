using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;
using TrackerStats.Api.Controllers;
using TrackerStats.Domain.Entities;
using TrackerStats.Domain.Plugins.Yaml;
using TrackerStats.Infrastructure.Plugins;
using TrackerStats.Infrastructure.Plugins.Source;
using TrackerStats.Infrastructure.Plugins.Storage;
using TrackerStats.Infrastructure.Plugins.Yaml;
using TrackerStats.Infrastructure.Services;
using TrackerStats.PluginEngine;

namespace TrackerStats.Backend.Tests;

public sealed class CustomPluginLifecycleTests : IDisposable
{
    private const string IntegrationPayload = """{"required_ratio":"1","baseUrl":"https://tracker.test/","cookie":"c","cron":"0 0 1 1 *"}""";

    private readonly string _root = Path.Combine(Path.GetTempPath(), $"trackerstats-customs-{Guid.NewGuid():N}");
    private readonly PluginStorageLayout _layout;
    private readonly PluginStateStore _stateStore;
    private readonly YamlPluginDefinitionLoader _loader;
    private readonly InMemoryIntegrationRepository _integrations = new();
    private readonly InMemoryIntegrationSnapshotRepository _snapshots = new();

    public CustomPluginLifecycleTests()
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
    public async Task S19_creating_a_custom_plugin_should_save_it_under_custom_as_sent()
    {
        var yaml = "# my tracker\n" + PluginYaml("my-tracker");

        var result = await CreateAsync(yaml);

        result.ShouldBeOfType<CreatedAtActionResult>().RouteValues!["pluginId"].ShouldBe("my-tracker");
        File.ReadAllText(CustomPath("my-tracker")).ShouldBe(yaml);
        AllFiles().ShouldBe([CustomPath("my-tracker")]);
        var effective = _loader.LoadDefinitions().ShouldHaveSingleItem();
        effective.Origin.ShouldBe(PluginOrigin.Custom);
        effective.IsValid.ShouldBeTrue();
    }

    [Fact]
    public async Task S19_creating_a_custom_plugin_without_schema_version_should_be_rejected()
    {
        var result = await CreateAsync(PluginYaml("my-tracker", schemaVersion: null));

        Error(result.ShouldBeOfType<BadRequestObjectResult>())
            .ShouldBe("Plugin definition is missing required field 'schemaVersion'.");
        AllFiles().ShouldBeEmpty();
    }

    [Fact]
    public async Task S19_saving_a_custom_plugin_without_schema_version_should_be_rejected()
    {
        var original = PluginYaml("my-tracker");
        WritePlugin(PluginOrigin.Custom, "my-tracker", original);

        var result = await UpdateAsync("my-tracker", PluginYaml("my-tracker", schemaVersion: null, displayName: "Changed"));

        Error(result.ShouldBeOfType<BadRequestObjectResult>())
            .ShouldBe("Plugin definition is missing required field 'schemaVersion'.");
        File.ReadAllText(CustomPath("my-tracker")).ShouldBe(original);
    }

    [Fact]
    public async Task S19_creating_a_custom_plugin_does_not_require_a_version()
    {
        var result = await CreateAsync(PluginYaml("my-tracker").Replace("version: 1.0.0\n", ""));

        result.ShouldBeOfType<CreatedAtActionResult>();
    }

    [Theory]
    [InlineData(PluginOrigin.Official)]
    [InlineData(PluginOrigin.Override)]
    public async Task S20_creating_a_custom_with_an_installed_official_id_should_be_rejected_with_an_explanation(PluginOrigin origin)
    {
        WritePlugin(origin, "asc", PluginYaml("asc"));

        var result = await CreateAsync(PluginYaml("asc", displayName: "Mine"));

        Error(result.ShouldBeOfType<ConflictObjectResult>())
            .ShouldBe("Plugin id 'asc' belongs to an official plugin, so a custom plugin cannot use it. " +
                      "Choose another id, or edit the official plugin to keep your own copy of it.");
        File.Exists(CustomPath("asc")).ShouldBeFalse();
    }

    [Fact]
    public async Task S20_an_official_id_known_only_from_the_index_should_be_rejected()
    {
        _stateStore.Update(state => state.Index = new PluginIndexState(
            "file:///source/",
            new string('a', 64),
            DateTimeOffset.UtcNow,
            new Dictionary<string, IndexedPluginState>
            {
                ["future"] = new("2.0.0", PluginSchema.SupportedPluginSchemaVersion + 1, new string('b', 64), Array.Empty<PluginIndexChangelogEntry>())
            }));

        var result = await CreateAsync(PluginYaml("future"));

        Error(result.ShouldBeOfType<ConflictObjectResult>()).ShouldStartWith("Plugin id 'future' belongs to an official plugin");
        File.Exists(CustomPath("future")).ShouldBeFalse();
    }

    [Fact]
    public async Task S20_an_official_id_recorded_in_state_without_its_file_should_be_rejected()
    {
        _stateStore.Update(state => state.Official["asc"] = new OfficialPluginState("1.0.0", new string('c', 64)));

        var result = await CreateAsync(PluginYaml("asc"));

        Error(result.ShouldBeOfType<ConflictObjectResult>()).ShouldStartWith("Plugin id 'asc' belongs to an official plugin");
    }

    [Fact]
    public async Task Creating_a_custom_whose_id_is_already_a_custom_should_conflict()
    {
        var original = PluginYaml("my-tracker");
        WritePlugin(PluginOrigin.Custom, "my-tracker", original);

        var result = await CreateAsync(PluginYaml("my-tracker", displayName: "Second"));

        Error(result.ShouldBeOfType<ConflictObjectResult>()).ShouldBe("Plugin 'my-tracker' already exists.");
        File.ReadAllText(CustomPath("my-tracker")).ShouldBe(original);
    }

    [Theory]
    [InlineData("../escaped")]
    [InlineData("My-Tracker")]
    [InlineData("bad_id")]
    [InlineData("-leading")]
    public async Task Creating_a_custom_with_an_invalid_id_should_be_rejected(string pluginId)
    {
        var result = await CreateAsync(PluginYaml(pluginId));

        Error(result.ShouldBeOfType<BadRequestObjectResult>()).ShouldStartWith($"Plugin id '{pluginId}' is invalid.");
        AllFiles().ShouldBeEmpty();
    }

    [Fact]
    public async Task S22_deleting_a_custom_used_by_integrations_should_conflict_and_list_them()
    {
        WritePlugin(PluginOrigin.Custom, "my-tracker", PluginYaml("my-tracker"));
        var first = SeedIntegration("my-tracker", """{"baseUrl":"https://one.test/","cookie":"secret-cookie"}""");
        var second = SeedIntegration("my-tracker", "not json");
        SeedIntegration("other");

        var result = await CreatePluginsController().Delete("my-tracker", CancellationToken.None);

        var conflict = TestHttp.ToJson(result.ShouldBeOfType<ConflictObjectResult>().Value);
        conflict.GetProperty("error").GetString().ShouldBe("Plugin 'my-tracker' is used by 2 integration(s). Delete them first.");
        var listed = conflict.GetProperty("integrations").EnumerateArray()
            .ToDictionary(item => item.GetProperty("id").GetGuid(), item => item.GetProperty("url").GetString());
        listed.Count.ShouldBe(2);
        listed[first.Id].ShouldBe("https://one.test/");
        listed[second.Id].ShouldBeNull();
        conflict.GetRawText().ShouldNotContain("secret-cookie");
        File.Exists(CustomPath("my-tracker")).ShouldBeTrue();
    }

    [Fact]
    public async Task S22_deleting_an_unused_custom_should_delete_it()
    {
        WritePlugin(PluginOrigin.Custom, "my-tracker", PluginYaml("my-tracker"));
        WritePlugin(PluginOrigin.Custom, "kept", PluginYaml("kept"));
        SeedIntegration("kept");
        var controller = CreatePluginsController();

        var result = await controller.Delete("my-tracker", CancellationToken.None);

        result.ShouldBeOfType<NoContentResult>();
        AllFiles().ShouldBe([CustomPath("kept")]);
        controller.GetByPluginId("my-tracker").ShouldBeOfType<NotFoundResult>();
    }

    [Fact]
    public async Task Deleting_an_invalid_unused_custom_should_delete_it()
    {
        WritePlugin(PluginOrigin.Custom, "broken", "pluginId: broken\nsteps: [unclosed");

        var result = await CreatePluginsController().Delete("broken", CancellationToken.None);

        result.ShouldBeOfType<NoContentResult>();
        File.Exists(CustomPath("broken")).ShouldBeFalse();
    }

    [Fact]
    public async Task Deleting_a_custom_that_hides_an_official_should_reveal_the_official()
    {
        WritePlugin(PluginOrigin.Official, "shared", PluginYaml("shared", displayName: "Official"));
        WritePlugin(PluginOrigin.Custom, "shared", PluginYaml("shared", displayName: "Custom"));

        var result = await CreatePluginsController().Delete("shared", CancellationToken.None);

        result.ShouldBeOfType<NoContentResult>();
        var effective = _loader.LoadDefinitions().ShouldHaveSingleItem();
        effective.Origin.ShouldBe(PluginOrigin.Official);
    }

    [Theory]
    [InlineData(PluginOrigin.Official)]
    [InlineData(PluginOrigin.Override)]
    public async Task Deleting_an_official_plugin_should_be_rejected(PluginOrigin origin)
    {
        var path = WritePlugin(origin, "asc", PluginYaml("asc"));

        var result = await CreatePluginsController().Delete("asc", CancellationToken.None);

        Error(result.ShouldBeOfType<BadRequestObjectResult>())
            .ShouldBe("Plugin 'asc' is official and cannot be deleted. Only custom plugins can be deleted.");
        File.Exists(path).ShouldBeTrue();
    }

    [Fact]
    public async Task Deleting_an_unknown_plugin_should_return_not_found()
    {
        var result = await CreatePluginsController().Delete("missing", CancellationToken.None);

        result.ShouldBeOfType<NotFoundObjectResult>();
    }

    [Theory]
    [InlineData("../escaped")]
    [InlineData("Seedpool")]
    public async Task Deleting_with_an_invalid_id_should_be_rejected(string pluginId)
    {
        Directory.CreateDirectory(_root);
        var outside = Path.Combine(_root, "plugins", "escaped.yaml");
        Directory.CreateDirectory(Path.GetDirectoryName(outside)!);
        File.WriteAllText(outside, "pluginId: escaped");

        var result = await CreatePluginsController().Delete(pluginId, CancellationToken.None);

        Error(result.ShouldBeOfType<BadRequestObjectResult>()).ShouldStartWith($"Plugin id '{pluginId}' is invalid.");
        File.Exists(outside).ShouldBeTrue();
    }

    [Fact]
    public async Task S27_an_integration_of_a_missing_plugin_should_report_plugin_not_found_keep_snapshots_and_reactivate()
    {
        var integration = SeedIntegration("legacy-custom", IntegrationPayload);
        var snapshot = new IntegrationSnapshot
        {
            Id = Guid.NewGuid(),
            IntegrationId = integration.Id,
            CapturedAt = DateTime.UtcNow.AddHours(-1),
            Ratio = 2.5m,
            UploadedBytes = 100,
            DownloadedBytes = 40
        };
        _snapshots.Seed(snapshot);
        var integrationsController = CreateIntegrationsController();

        var listed = await ListSingleAsync(integrationsController);
        listed.GetProperty("configurationValid").GetBoolean().ShouldBeFalse();
        listed.GetProperty("configurationErrorCode").GetString().ShouldBe(IntegrationConfigurationErrorCodes.PluginNotFound);
        listed.GetProperty("configurationError").GetString().ShouldBe("Plugin 'legacy-custom' not found.");

        var sync = await integrationsController.Sync(integration.Id, CancellationToken.None);
        TestHttp.ToJson(sync.ShouldBeOfType<BadRequestObjectResult>().Value)
            .GetProperty("code").GetString().ShouldBe(IntegrationConfigurationErrorCodes.PluginNotFound);
        _integrations.Updated.ShouldBeEmpty("a missing plugin skips the sync");
        (await SnapshotIdsAsync(integrationsController, integration.Id)).ShouldBe([snapshot.Id]);

        (await CreateAsync(PluginYaml("legacy-custom"))).ShouldBeOfType<CreatedAtActionResult>();

        var reactivated = await ListSingleAsync(integrationsController);
        reactivated.GetProperty("configurationValid").GetBoolean().ShouldBeTrue();
        reactivated.GetProperty("configurationErrorCode").ValueKind.ShouldBe(JsonValueKind.Null);
        reactivated.GetProperty("dashboard").ValueKind.ShouldBe(JsonValueKind.Object);
        _integrations.Find(integration.Id).ShouldNotBeNull().Payload.ShouldBe(IntegrationPayload);
        (await SnapshotIdsAsync(integrationsController, integration.Id)).ShouldBe([snapshot.Id]);
    }

    [Fact]
    public async Task S27_the_recurring_sync_should_skip_an_integration_whose_plugin_is_missing()
    {
        var integration = SeedIntegration("legacy-custom", IntegrationPayload);
        var registry = CreateRegistry();
        var syncService = CreateSyncService(registry);

        var outcome = await syncService.SyncAsync(integration.Id, CancellationToken.None);

        outcome.PluginExists.ShouldBeFalse();
        outcome.ConfigurationErrorCode.ShouldBe(IntegrationConfigurationErrorCodes.PluginNotFound);
        _integrations.Updated.ShouldBeEmpty();
        _snapshots.Added.ShouldBeEmpty();
    }

    private async Task<IActionResult> CreateAsync(string yaml)
    {
        var controller = CreatePluginsController();
        TestHttp.SetYamlBody(controller, yaml);
        return await controller.Create(CancellationToken.None);
    }

    private async Task<IActionResult> UpdateAsync(string pluginId, string yaml)
    {
        var controller = CreatePluginsController();
        TestHttp.SetYamlBody(controller, yaml);
        return await controller.Update(pluginId, CancellationToken.None);
    }

    private PluginsController CreatePluginsController() =>
        new(
            _loader,
            _layout,
            new PluginOverrideService(_layout, _stateStore, new PluginBaseStore(_layout), NullLogger<PluginOverrideService>.Instance),
            _stateStore,
            new PluginBaseStore(_layout),
            new PluginStatusService(_loader, _layout, _stateStore),
            _integrations);

    private TrackerPluginRegistry CreateRegistry() =>
        new(
            new ServiceCollection().BuildServiceProvider(),
            new YamlPluginEngine(
                new ListLogger<YamlPluginEngine>(), [], [], new TemplateInterpolator(), new AuthFailureDetector(), new ResultMapper()),
            new TemplateInterpolator(),
            _loader);

    private IntegrationSyncService CreateSyncService(TrackerPluginRegistry registry) =>
        new(
            _integrations,
            _snapshots,
            registry,
            new FakeTrackerPluginHttpClientFactory(),
            new IntegrationConfigurationValidator(registry),
            NullLogger<IntegrationSyncService>.Instance);

    private IntegrationsController CreateIntegrationsController()
    {
        var registry = CreateRegistry();
        var validator = new IntegrationConfigurationValidator(registry);
        var manager = new FakeRecurringJobManager();
        var scopeFactory = new ServiceCollection().BuildServiceProvider().GetRequiredService<IServiceScopeFactory>();
        return new IntegrationsController(
            _integrations,
            _snapshots,
            registry,
            new InMemoryProxyRepository(),
            validator,
            CreateSyncService(registry),
            new IntegrationRecurringJobScheduler(manager, new FakeJobStorage(new FakeStorageConnection()), scopeFactory),
            new CreateIntegrationRequestValidator(registry, validator),
            new UpdateIntegrationRequestValidator(registry, validator));
    }

    private static async Task<JsonElement> ListSingleAsync(IntegrationsController controller)
    {
        var result = await controller.List(CancellationToken.None);
        return TestHttp.ToJson(result.ShouldBeOfType<OkObjectResult>().Value).EnumerateArray().ShouldHaveSingleItem();
    }

    private static async Task<List<Guid>> SnapshotIdsAsync(IntegrationsController controller, Guid integrationId)
    {
        var result = await controller.GetSnapshots(integrationId, null, null, CancellationToken.None);
        return TestHttp.ToJson(result.ShouldBeOfType<OkObjectResult>().Value).EnumerateArray()
            .Select(item => item.GetProperty("id").GetGuid())
            .ToList();
    }

    private Integration SeedIntegration(string pluginId, string payload = "{}")
    {
        var integration = new Integration { Id = Guid.NewGuid(), PluginId = pluginId, Payload = payload, RequiredRatio = 1m };
        _integrations.Seed(integration);
        return integration;
    }

    private string WritePlugin(PluginOrigin origin, string pluginId, string content)
    {
        var path = _layout.GetPluginPath(origin, pluginId);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, content);
        return path;
    }

    private string CustomPath(string pluginId) => _layout.GetPluginPath(PluginOrigin.Custom, pluginId);

    private List<string> AllFiles() =>
        Directory.Exists(_root)
            ? Directory.EnumerateFiles(_root, "*", SearchOption.AllDirectories).ToList()
            : [];

    private static string? Error(ObjectResult result) => TestHttp.ToJson(result.Value).GetProperty("error").GetString();

    private static string PluginYaml(string pluginId, int? schemaVersion = 1, string? displayName = null) => $"""
        pluginId: {pluginId}
        displayName: {displayName ?? $"Plugin {pluginId}"}
        version: 1.0.0
        {(schemaVersion is null ? "" : $"schemaVersion: {schemaVersion}")}
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

