using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;
using TrackerStats.Domain.Entities;
using TrackerStats.Domain.Plugins;
using TrackerStats.Infrastructure.Services;

namespace TrackerStats.Backend.Tests;

public class IntegrationSyncServiceTests
{
    [Fact]
    public async Task SyncAsync_should_return_not_found_when_integration_does_not_exist()
    {
        var repository = new InMemoryIntegrationRepository();
        var snapshots = new InMemoryIntegrationSnapshotRepository();
        var registry = new FakeTrackerPluginRegistry();
        var validator = new IntegrationConfigurationValidator(registry);
        var sut = new IntegrationSyncService(
            repository,
            snapshots,
            registry,
            new FakeTrackerPluginHttpClientFactory(),
            validator,
            NullLogger<IntegrationSyncService>.Instance);

        var result = await sut.SyncAsync(Guid.NewGuid(), CancellationToken.None);

        result.WasFound.ShouldBeFalse();
        result.PluginExists.ShouldBeFalse();
    }

    [Fact]
    public async Task SyncAsync_should_persist_stats_and_snapshot_on_success()
    {
        var integration = new Integration
        {
            Id = Guid.NewGuid(),
            PluginId = "plugin",
            Payload = """{"required_ratio":"1.5","username":"alice"}""",
            RequiredRatio = 1.5m
        };
        var repository = new InMemoryIntegrationRepository();
        repository.Seed(integration);
        var snapshots = new InMemoryIntegrationSnapshotRepository();
        var registry = new FakeTrackerPluginRegistry();
        var plugin = new FakeTrackerPlugin(
            "plugin",
            [
                new PluginField("required_ratio", "Required Ratio", null, "number", true, false),
                new PluginField("username", "Username", null, "text", true, false)
            ],
            fetch: (_, _) => Task.FromResult(new TrackerFetchResult(
                PluginProcessResult.Success,
                new global::TrackerStats.Domain.Plugins.TrackerStats(
                    Ratio: 2.5m,
                    UploadedBytes: 1000,
                    DownloadedBytes: 500,
                    SeedBonus: "42",
                    Buffer: "safe",
                    HitAndRuns: 1,
                    RequiredRatio: 1.5m,
                    SeedingTorrents: 7,
                    LeechingTorrents: 2,
                    ActiveTorrents: 9))));
        registry.RegisterFactory("plugin", _ => plugin, plugin);
        var validator = new IntegrationConfigurationValidator(registry);
        var sut = new IntegrationSyncService(
            repository,
            snapshots,
            registry,
            new FakeTrackerPluginHttpClientFactory(),
            validator,
            NullLogger<IntegrationSyncService>.Instance);

        var result = await sut.SyncAsync(integration.Id, CancellationToken.None);

        result.Result.ShouldBe(PluginProcessResult.Success);
        repository.Updated.Count.ShouldBe(1);
        snapshots.Added.Count.ShouldBe(1);

        var updated = repository.Find(integration.Id);
        updated.ShouldNotBeNull();
        updated.Ratio.ShouldBe(2.5m);
        updated.UploadedBytes.ShouldBe(1000);
        updated.LastSyncResult.ShouldBe(PluginProcessResult.Success);

        snapshots.Added[0].IntegrationId.ShouldBe(integration.Id);
        snapshots.Added[0].ActiveTorrents.ShouldBe(9);
    }

    [Fact]
    public async Task SyncAsync_should_convert_success_without_stats_into_unknown_error()
    {
        var integration = new Integration
        {
            Id = Guid.NewGuid(),
            PluginId = "plugin",
            Payload = """{"required_ratio":"1.5"}""",
            RequiredRatio = 1.5m
        };
        var repository = new InMemoryIntegrationRepository();
        repository.Seed(integration);
        var snapshots = new InMemoryIntegrationSnapshotRepository();
        var registry = new FakeTrackerPluginRegistry();
        var plugin = new FakeTrackerPlugin(
            "plugin",
            [new PluginField("required_ratio", "Required Ratio", null, "number", true, false)],
            fetch: (_, _) => Task.FromResult(new TrackerFetchResult(PluginProcessResult.Success)));
        registry.RegisterFactory("plugin", _ => plugin, plugin);
        var validator = new IntegrationConfigurationValidator(registry);
        var sut = new IntegrationSyncService(
            repository,
            snapshots,
            registry,
            new FakeTrackerPluginHttpClientFactory(),
            validator,
            NullLogger<IntegrationSyncService>.Instance);

        var result = await sut.SyncAsync(integration.Id, CancellationToken.None);

        result.Result.ShouldBe(PluginProcessResult.UnknownError);
        snapshots.Added.ShouldBeEmpty();
        repository.Find(integration.Id)!.LastSyncResult.ShouldBe(PluginProcessResult.UnknownError);
    }
}
