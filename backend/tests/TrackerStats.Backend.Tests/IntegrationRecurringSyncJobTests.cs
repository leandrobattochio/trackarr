using Shouldly;
using TrackerStats.Domain.Entities;
using TrackerStats.Domain.Plugins;
using TrackerStats.Infrastructure.Services;

namespace TrackerStats.Backend.Tests;

public class IntegrationRecurringSyncJobTests
{
    [Fact]
    public async Task ExecuteAsync_should_log_warning_when_integration_is_missing()
    {
        var logger = new ListLogger<IntegrationRecurringSyncJob>();
        var job = new IntegrationRecurringSyncJob(CreateSyncService(), logger);

        await job.ExecuteAsync(Guid.NewGuid());

        logger.Entries.ShouldContain(entry =>
            entry.Level == Microsoft.Extensions.Logging.LogLevel.Warning
            && entry.Message.Contains("not found during recurring sync", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task ExecuteAsync_should_log_warning_when_plugin_is_missing()
    {
        var integrationId = Guid.NewGuid();
        var repository = new InMemoryIntegrationRepository();
        repository.Seed(new Integration
        {
            Id = integrationId,
            PluginId = "missing",
            Payload = """{"required_ratio":"1.0"}"""
        });
        var logger = new ListLogger<IntegrationRecurringSyncJob>();
        var job = new IntegrationRecurringSyncJob(CreateSyncService(repository: repository), logger);

        await job.ExecuteAsync(integrationId);

        logger.Entries.ShouldContain(entry =>
            entry.Level == Microsoft.Extensions.Logging.LogLevel.Warning
            && entry.Message.Contains("Plugin 'missing' not found", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task ExecuteAsync_should_log_warning_when_configuration_is_invalid()
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
        var logger = new ListLogger<IntegrationRecurringSyncJob>();
        var job = new IntegrationRecurringSyncJob(CreateSyncService(repository, registry), logger);

        await job.ExecuteAsync(integrationId);

        logger.Entries.ShouldContain(entry =>
            entry.Level == Microsoft.Extensions.Logging.LogLevel.Warning
            && entry.Message.Contains("is no longer valid", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task ExecuteAsync_should_log_information_when_sync_completes()
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
        var registry = new FakeTrackerPluginRegistry();
        var plugin = new FakeTrackerPlugin(
            "plugin",
            [new PluginField("required_ratio", "Required Ratio", "number", true, false)],
            fetch: (_, _) => Task.FromResult(new TrackerFetchResult(PluginProcessResult.UnknownError)));
        registry.RegisterFactory("plugin", _ => plugin, plugin);
        var logger = new ListLogger<IntegrationRecurringSyncJob>();
        var job = new IntegrationRecurringSyncJob(CreateSyncService(repository, registry), logger);

        await job.ExecuteAsync(integrationId);

        logger.Entries.ShouldContain(entry =>
            entry.Level == Microsoft.Extensions.Logging.LogLevel.Information
            && entry.Message.Contains("Recurring sync finished", StringComparison.OrdinalIgnoreCase));
    }

    private static IntegrationSyncService CreateSyncService(
        InMemoryIntegrationRepository? repository = null,
        FakeTrackerPluginRegistry? registry = null)
    {
        repository ??= new InMemoryIntegrationRepository();
        registry ??= new FakeTrackerPluginRegistry();
        var snapshots = new InMemoryIntegrationSnapshotRepository();
        var validator = new IntegrationConfigurationValidator(registry);

        return new IntegrationSyncService(
            repository,
            snapshots,
            registry,
            new FakeTrackerPluginHttpClientFactory(),
            validator,
            new ListLogger<IntegrationSyncService>());
    }
}
