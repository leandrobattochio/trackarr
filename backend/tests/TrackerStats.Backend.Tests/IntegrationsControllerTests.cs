using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Shouldly;
using TrackerStats.Api.Controllers;
using TrackerStats.Domain.Entities;
using TrackerStats.Domain.Plugins;
using TrackerStats.Infrastructure.Services;

namespace TrackerStats.Backend.Tests;

public class IntegrationsControllerTests
{
    [Fact]
    public async Task Sync_should_return_not_found_when_integration_is_missing()
    {
        var controller = CreateController();

        var result = await controller.Sync(Guid.NewGuid(), CancellationToken.None);

        result.ShouldBeOfType<NotFoundResult>();
    }

    [Fact]
    public async Task Sync_should_return_bad_request_when_plugin_is_missing()
    {
        var integrationId = Guid.NewGuid();
        var repository = new InMemoryIntegrationRepository();
        repository.Seed(new Integration
        {
            Id = integrationId,
            PluginId = "missing",
            Payload = """{"required_ratio":"1.0"}"""
        });
        var controller = CreateController(repository: repository);

        var result = await controller.Sync(integrationId, CancellationToken.None);

        var badRequest = result.ShouldBeOfType<BadRequestObjectResult>();
        var error = TestHttp.ToJson(badRequest.Value).GetProperty("error").GetString();
        error.ShouldNotBeNull();
        error.ShouldContain("Plugin 'missing' not found.");
    }

    [Fact]
    public async Task Sync_should_return_bad_request_when_configuration_is_invalid()
    {
        var integrationId = Guid.NewGuid();
        var repository = new InMemoryIntegrationRepository();
        repository.Seed(new Integration
        {
            Id = integrationId,
            PluginId = "plugin",
            Payload = """{"required_ratio":"1.0"}"""
        });
        var registry = new FakeTrackerPluginRegistry();
        registry.Register(new FakeTrackerPlugin("plugin",
        [
            new PluginField("required_ratio", "Required Ratio", "number", true, false),
            new PluginField("username", "Username", "text", true, false)
        ]));
        var controller = CreateController(repository, registry);

        var result = await controller.Sync(integrationId, CancellationToken.None);

        var badRequest = result.ShouldBeOfType<BadRequestObjectResult>();
        var error = TestHttp.ToJson(badRequest.Value).GetProperty("error").GetString();
        error.ShouldNotBeNull();
        error.ShouldContain("Integration is missing required fields: username.");
    }

    [Fact]
    public async Task Create_should_return_bad_request_when_plugin_is_missing()
    {
        var controller = CreateController();

        var result = await controller.Create(new CreateIntegrationRequest("missing", """{"required_ratio":"1.0"}"""), CancellationToken.None);

        var badRequest = result.ShouldBeOfType<BadRequestObjectResult>();
        TestHttp.ToJson(badRequest.Value).GetProperty("error").GetString().ShouldBe("Plugin 'missing' not found.");
    }

    [Fact]
    public async Task Create_should_return_bad_request_when_payload_is_missing()
    {
        var registry = new FakeTrackerPluginRegistry();
        registry.Register(new FakeTrackerPlugin("plugin"));
        var controller = CreateController(registry: registry);

        var result = await controller.Create(new CreateIntegrationRequest("plugin", ""), CancellationToken.None);

        var badRequest = result.ShouldBeOfType<BadRequestObjectResult>();
        TestHttp.ToJson(badRequest.Value).GetProperty("error").GetString().ShouldBe("Payload is required.");
    }

    [Fact]
    public async Task Create_should_return_bad_request_when_configuration_is_invalid()
    {
        var registry = new FakeTrackerPluginRegistry();
        registry.Register(new FakeTrackerPlugin("plugin",
        [
            new PluginField("required_ratio", "Required Ratio", "number", true, false),
            new PluginField("username", "Username", "text", true, false)
        ]));
        var controller = CreateController(registry: registry);

        var result = await controller.Create(new CreateIntegrationRequest("plugin", """{"required_ratio":"1.0"}"""), CancellationToken.None);

        var badRequest = result.ShouldBeOfType<BadRequestObjectResult>();
        var error = TestHttp.ToJson(badRequest.Value).GetProperty("error").GetString();
        error.ShouldNotBeNull();
        error.ShouldContain("Integration is missing required fields: username.");
    }

    [Fact]
    public async Task Create_should_persist_integration_and_schedule_job_when_valid()
    {
        var repository = new InMemoryIntegrationRepository();
        var scheduler = CreateScheduler();
        var registry = new FakeTrackerPluginRegistry();
        registry.Register(new FakeTrackerPlugin("plugin",
        [
            new PluginField("required_ratio", "Required Ratio", "number", true, false),
            new PluginField("username", "Username", "text", true, false)
        ]));
        var controller = CreateController(repository: repository, registry: registry, scheduler: scheduler);

        var result = await controller.Create(
            new CreateIntegrationRequest("plugin", """{"required_ratio":"1.5","username":"alice","cron":"0 * * * *"}"""),
            CancellationToken.None);

        var created = result.ShouldBeOfType<CreatedAtActionResult>();
        var json = TestHttp.ToJson(created.Value);
        json.GetProperty("pluginId").GetString().ShouldBe("plugin");
        json.GetProperty("requiredRatio").GetDecimal().ShouldBe(1.5m);
        repository.Added.Count.ShouldBe(1);
        scheduler.Manager.AddOrUpdates.Count.ShouldBe(1);
    }

    [Fact]
    public async Task Update_should_return_not_found_when_integration_does_not_exist()
    {
        var controller = CreateController();

        var result = await controller.Update(Guid.NewGuid(), new UpdateIntegrationRequest("plugin", """{"required_ratio":"1.0"}"""), CancellationToken.None);

        result.ShouldBeOfType<NotFoundResult>();
    }

    [Fact]
    public async Task Update_should_return_bad_request_when_plugin_id_changes()
    {
        var integrationId = Guid.NewGuid();
        var repository = new InMemoryIntegrationRepository();
        repository.Seed(new Integration
        {
            Id = integrationId,
            PluginId = "plugin",
            Payload = """{"required_ratio":"1.0"}"""
        });
        var controller = CreateController(repository: repository);

        var result = await controller.Update(integrationId, new UpdateIntegrationRequest("other", """{"required_ratio":"1.0"}"""), CancellationToken.None);

        var badRequest = result.ShouldBeOfType<BadRequestObjectResult>();
        TestHttp.ToJson(badRequest.Value).GetProperty("error").GetString().ShouldBe("PluginId cannot be changed for an existing integration.");
    }

    [Fact]
    public async Task Update_should_return_bad_request_when_plugin_is_missing()
    {
        var integrationId = Guid.NewGuid();
        var repository = new InMemoryIntegrationRepository();
        repository.Seed(new Integration
        {
            Id = integrationId,
            PluginId = "plugin",
            Payload = """{"required_ratio":"1.0"}"""
        });
        var controller = CreateController(repository: repository);

        var result = await controller.Update(integrationId, new UpdateIntegrationRequest("plugin", """{"required_ratio":"1.0"}"""), CancellationToken.None);

        var badRequest = result.ShouldBeOfType<BadRequestObjectResult>();
        TestHttp.ToJson(badRequest.Value).GetProperty("error").GetString().ShouldBe("Plugin 'plugin' not found.");
    }

    [Fact]
    public async Task Update_should_return_bad_request_when_payload_is_missing()
    {
        var integrationId = Guid.NewGuid();
        var repository = new InMemoryIntegrationRepository();
        repository.Seed(new Integration
        {
            Id = integrationId,
            PluginId = "plugin",
            Payload = """{"required_ratio":"1.0"}"""
        });
        var registry = new FakeTrackerPluginRegistry();
        registry.Register(new FakeTrackerPlugin("plugin"));
        var controller = CreateController(repository: repository, registry: registry);

        var result = await controller.Update(integrationId, new UpdateIntegrationRequest("plugin", ""), CancellationToken.None);

        var badRequest = result.ShouldBeOfType<BadRequestObjectResult>();
        TestHttp.ToJson(badRequest.Value).GetProperty("error").GetString().ShouldBe("Payload is required.");
    }

    [Fact]
    public async Task Update_should_return_bad_request_when_configuration_is_invalid()
    {
        var integrationId = Guid.NewGuid();
        var repository = new InMemoryIntegrationRepository();
        repository.Seed(new Integration
        {
            Id = integrationId,
            PluginId = "plugin",
            Payload = """{"required_ratio":"1.0","secret":"real"}"""
        });
        var registry = new FakeTrackerPluginRegistry();
        registry.Register(new FakeTrackerPlugin("plugin",
        [
            new PluginField("required_ratio", "Required Ratio", "number", true, false),
            new PluginField("username", "Username", "text", true, false),
            new PluginField("secret", "Secret", "text", true, true)
        ]));
        var controller = CreateController(repository, registry);

        var result = await controller.Update(integrationId, new UpdateIntegrationRequest("plugin", """{"required_ratio":"1.0","secret":"*****"}"""), CancellationToken.None);

        var badRequest = result.ShouldBeOfType<BadRequestObjectResult>();
        var error = TestHttp.ToJson(badRequest.Value).GetProperty("error").GetString();
        error.ShouldNotBeNull();
        error.ShouldContain("Integration is missing required fields: username.");
    }

    [Fact]
    public async Task Update_should_merge_masked_sensitive_fields_and_schedule_job_when_valid()
    {
        var integrationId = Guid.NewGuid();
        var repository = new InMemoryIntegrationRepository();
        repository.Seed(new Integration
        {
            Id = integrationId,
            PluginId = "plugin",
            Payload = """{"required_ratio":"1.0","username":"alice","secret":"real","cron":"0 * * * *"}""",
            RequiredRatio = 1.0m
        });
        var scheduler = CreateScheduler();
        var registry = new FakeTrackerPluginRegistry();
        registry.Register(new FakeTrackerPlugin("plugin",
        [
            new PluginField("required_ratio", "Required Ratio", "number", true, false),
            new PluginField("username", "Username", "text", true, false),
            new PluginField("secret", "Secret", "text", true, true)
        ]));
        var controller = CreateController(repository, registry, scheduler: scheduler);

        var result = await controller.Update(
            integrationId,
            new UpdateIntegrationRequest("plugin", """{"required_ratio":"2.0","username":"alice","secret":"*****","cron":"15 * * * *"}"""),
            CancellationToken.None);

        var ok = result.ShouldBeOfType<OkObjectResult>();
        var json = TestHttp.ToJson(ok.Value);
        json.GetProperty("requiredRatio").GetDecimal().ShouldBe(2.0m);
        repository.Updated.Count.ShouldBe(1);
        repository.Find(integrationId)!.Payload.ShouldContain("real");
        scheduler.Manager.AddOrUpdates.Count.ShouldBe(1);
    }

    [Fact]
    public async Task GetSnapshots_should_return_not_found_when_integration_does_not_exist()
    {
        var controller = CreateController();

        var result = await controller.GetSnapshots(Guid.NewGuid(), null, null, CancellationToken.None);

        result.ShouldBeOfType<NotFoundResult>();
    }

    [Fact]
    public async Task GetSnapshots_should_return_snapshots_for_existing_integration()
    {
        var integrationId = Guid.NewGuid();
        var repository = new InMemoryIntegrationRepository();
        repository.Seed(new Integration
        {
            Id = integrationId,
            PluginId = "plugin",
            Payload = """{"required_ratio":"1.0"}"""
        });
        var snapshots = new InMemoryIntegrationSnapshotRepository();
        snapshots.Seed(new IntegrationSnapshot
        {
            Id = Guid.NewGuid(),
            IntegrationId = integrationId,
            CapturedAt = new DateTime(2026, 4, 5, 12, 0, 0, DateTimeKind.Utc),
            Ratio = 1.2m
        });
        var controller = CreateController(repository, snapshotRepository: snapshots);

        var result = await controller.GetSnapshots(integrationId, null, null, CancellationToken.None);

        var ok = result.ShouldBeOfType<OkObjectResult>();
        var json = TestHttp.ToJson(ok.Value);
        json.GetArrayLength().ShouldBe(1);
        json[0].GetProperty("ratio").GetDecimal().ShouldBe(1.2m);
    }

    [Fact]
    public async Task Delete_should_remove_existing_integration_and_unschedule_job()
    {
        var integrationId = Guid.NewGuid();
        var repository = new InMemoryIntegrationRepository();
        repository.Seed(new Integration
        {
            Id = integrationId,
            PluginId = "plugin",
            Payload = """{"required_ratio":"1.0"}"""
        });
        var scheduler = CreateScheduler();
        var controller = CreateController(repository: repository, scheduler: scheduler);

        var result = await controller.Delete(integrationId, CancellationToken.None);

        result.ShouldBeOfType<NoContentResult>();
        repository.Deleted.ShouldContain(integrationId);
        scheduler.Manager.RemovedJobIds.ShouldContain($"integration-sync:{integrationId:N}");
    }

    [Fact]
    public async Task List_should_return_integrations_with_sanitized_payload()
    {
        var integrationId = Guid.NewGuid();
        var repository = new InMemoryIntegrationRepository();
        repository.Seed(new Integration
        {
            Id = integrationId,
            PluginId = "plugin",
            Payload = """{"required_ratio":"1.0","username":"alice","secret":"real","baseUrl":"https://tracker.test"}""",
            RequiredRatio = 1.0m,
            Ratio = 2.5m,
            UploadedBytes = 100
        });
        var scheduler = CreateScheduler();
        var registry = new FakeTrackerPluginRegistry();
        registry.Register(new FakeTrackerPlugin("plugin",
        [
            new PluginField("required_ratio", "Required Ratio", "number", true, false),
            new PluginField("username", "Username", "text", true, false),
            new PluginField("secret", "Secret", "text", true, true)
        ]));
        var controller = CreateController(repository, registry, scheduler: scheduler);

        var result = await controller.List(CancellationToken.None);

        var ok = result.ShouldBeOfType<OkObjectResult>();
        var json = TestHttp.ToJson(ok.Value);
        json.GetArrayLength().ShouldBe(1);
        json[0].GetProperty("pluginId").GetString().ShouldBe("plugin");
        json[0].GetProperty("payload").TryGetProperty("secret", out _).ShouldBeFalse();
        json[0].GetProperty("stats").GetProperty("ratio").GetDecimal().ShouldBe(2.5m);
    }

    [Fact]
    public async Task Sync_should_return_ok_with_updated_stats_when_plugin_fetch_succeeds()
    {
        var integrationId = Guid.NewGuid();
        var repository = new InMemoryIntegrationRepository();
        repository.Seed(new Integration
        {
            Id = integrationId,
            PluginId = "plugin",
            Payload = """{"required_ratio":"1.0"}""",
            RequiredRatio = 1.0m
        });
        var scheduler = CreateScheduler();
        var registry = new FakeTrackerPluginRegistry();
        var plugin = new FakeTrackerPlugin(
            "plugin",
            [new PluginField("required_ratio", "Required Ratio", "number", true, false)],
            fetch: (_, _) => Task.FromResult(new TrackerFetchResult(
                PluginProcessResult.Success,
                new global::TrackerStats.Domain.Plugins.TrackerStats(
                    Ratio: 3.5m,
                    UploadedBytes: 10,
                    DownloadedBytes: 5,
                    SeedBonus: "11",
                    Buffer: "safe",
                    HitAndRuns: 0,
                    RequiredRatio: 1.0m,
                    SeedingTorrents: 4,
                    LeechingTorrents: 1,
                    ActiveTorrents: 5))));
        registry.RegisterFactory("plugin", _ => plugin, plugin);
        var controller = CreateController(repository, registry, scheduler: scheduler);

        var result = await controller.Sync(integrationId, CancellationToken.None);

        var ok = result.ShouldBeOfType<OkObjectResult>();
        var json = TestHttp.ToJson(ok.Value);
        json.GetProperty("stats").GetProperty("ratio").GetDecimal().ShouldBe(3.5m);
    }

    private static IntegrationsController CreateController(
        InMemoryIntegrationRepository? repository = null,
        FakeTrackerPluginRegistry? registry = null,
        InMemoryIntegrationSnapshotRepository? snapshotRepository = null,
        FakeSchedulerBundle? scheduler = null)
    {
        repository ??= new InMemoryIntegrationRepository();
        registry ??= new FakeTrackerPluginRegistry();
        snapshotRepository ??= new InMemoryIntegrationSnapshotRepository();
        scheduler ??= CreateScheduler();
        var validator = new IntegrationConfigurationValidator(registry);
        var syncService = new IntegrationSyncService(
            repository,
            snapshotRepository,
            registry,
            new FakeTrackerPluginHttpClientFactory(),
            validator,
            new ListLogger<IntegrationSyncService>());
        var createValidator = new CreateIntegrationRequestValidator(registry, validator);
        var updateValidator = new UpdateIntegrationRequestValidator(registry, validator);

        return new IntegrationsController(
            repository,
            snapshotRepository,
            registry,
            new FakeTrackerPluginHttpClientFactory(),
            validator,
            syncService,
            scheduler.Scheduler,
            createValidator,
            updateValidator);
    }

    private static FakeSchedulerBundle CreateScheduler()
    {
        var manager = new FakeRecurringJobManager();
        var storage = new FakeJobStorage(new FakeStorageConnection());
        var scopeFactory = new Microsoft.Extensions.DependencyInjection.ServiceCollection().BuildServiceProvider().GetRequiredService<Microsoft.Extensions.DependencyInjection.IServiceScopeFactory>();
        return new FakeSchedulerBundle(manager, new IntegrationRecurringJobScheduler(manager, storage, scopeFactory));
    }

    private sealed record FakeSchedulerBundle(
        FakeRecurringJobManager Manager,
        IntegrationRecurringJobScheduler Scheduler);
}
