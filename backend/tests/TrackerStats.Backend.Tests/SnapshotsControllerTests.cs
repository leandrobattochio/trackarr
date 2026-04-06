using Microsoft.AspNetCore.Mvc;
using Shouldly;
using TrackerStats.Api.Controllers;
using TrackerStats.Domain.Entities;

namespace TrackerStats.Backend.Tests;

public class SnapshotsControllerTests
{
    [Fact]
    public async Task List_should_require_integration_id()
    {
        var controller = new SnapshotsController(new InMemoryIntegrationRepository(), new InMemoryIntegrationSnapshotRepository());

        var result = await controller.List(null, null, null, null, CancellationToken.None);

        var badRequest = result.ShouldBeOfType<BadRequestObjectResult>();
        TestHttp.ToJson(badRequest.Value).GetProperty("error").GetString().ShouldBe("Query parameter 'integrationId' is required.");
    }

    [Fact]
    public async Task List_should_return_not_found_when_integration_does_not_exist()
    {
        var controller = new SnapshotsController(new InMemoryIntegrationRepository(), new InMemoryIntegrationSnapshotRepository());

        var result = await controller.List(Guid.NewGuid(), null, null, null, CancellationToken.None);

        var notFound = result.ShouldBeOfType<NotFoundObjectResult>();
        TestHttp.ToJson(notFound.Value).GetProperty("error").GetString().ShouldBe("Integration not found.");
    }

    [Fact]
    public async Task List_should_return_snapshots_for_integration()
    {
        var integrationId = Guid.NewGuid();
        var repository = new InMemoryIntegrationRepository();
        repository.Seed(new Integration
        {
            Id = integrationId,
            PluginId = "plugin",
            Payload = "{}"
        });
        var snapshots = new InMemoryIntegrationSnapshotRepository();
        snapshots.Seed(new IntegrationSnapshot
        {
            Id = Guid.NewGuid(),
            IntegrationId = integrationId,
            CapturedAt = new DateTime(2026, 4, 5, 11, 45, 0, DateTimeKind.Utc),
            Ratio = 1.5m,
            ActiveTorrents = 3
        });
        var controller = new SnapshotsController(repository, snapshots, new FakeTimeProvider(new DateTimeOffset(2026, 4, 5, 12, 0, 0, TimeSpan.Zero)));

        var result = await controller.List(integrationId, "1h", null, null, CancellationToken.None);

        var ok = result.ShouldBeOfType<OkObjectResult>();
        var json = TestHttp.ToJson(ok.Value);
        json.GetProperty("integrationId").GetGuid().ShouldBe(integrationId);
        json.GetProperty("range").GetString().ShouldBe("1h");
        json.GetProperty("items").GetArrayLength().ShouldBe(1);
        json.GetProperty("items")[0].GetProperty("ratio").GetDecimal().ShouldBe(1.5m);
        json.GetProperty("items")[0].GetProperty("activeTorrents").GetInt32().ShouldBe(3);
        json.GetProperty("items")[0].GetProperty("capturedAt").GetDateTime().Kind.ShouldBe(DateTimeKind.Utc);
    }

    [Fact]
    public async Task List_should_require_from_and_to_when_range_is_custom()
    {
        var integrationId = Guid.NewGuid();
        var repository = new InMemoryIntegrationRepository();
        repository.Seed(new Integration { Id = integrationId, PluginId = "plugin", Payload = "{}" });
        var controller = new SnapshotsController(repository, new InMemoryIntegrationSnapshotRepository());

        var result = await controller.List(integrationId, "custom", null, null, CancellationToken.None);

        var badRequest = result.ShouldBeOfType<BadRequestObjectResult>();
        TestHttp.ToJson(badRequest.Value).GetProperty("error").GetString()
            .ShouldBe("Query parameters 'from' and 'to' are required when range is 'custom'.");
    }

    [Fact]
    public async Task List_should_reject_unknown_range()
    {
        var integrationId = Guid.NewGuid();
        var repository = new InMemoryIntegrationRepository();
        repository.Seed(new Integration { Id = integrationId, PluginId = "plugin", Payload = "{}" });
        var controller = new SnapshotsController(repository, new InMemoryIntegrationSnapshotRepository());

        var result = await controller.List(integrationId, "2d", null, null, CancellationToken.None);

        var badRequest = result.ShouldBeOfType<BadRequestObjectResult>();
        TestHttp.ToJson(badRequest.Value).GetProperty("error").GetString()
            .ShouldBe("Query parameter 'range' must be one of: 5m, 15m, 1h, 6h, 24h, custom.");
    }

    [Fact]
    public async Task List_should_reject_custom_range_when_from_is_after_to()
    {
        var integrationId = Guid.NewGuid();
        var repository = new InMemoryIntegrationRepository();
        repository.Seed(new Integration { Id = integrationId, PluginId = "plugin", Payload = "{}" });
        var controller = new SnapshotsController(repository, new InMemoryIntegrationSnapshotRepository());

        var result = await controller.List(
            integrationId,
            "custom",
            new DateTime(2026, 4, 6, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 4, 5, 0, 0, 0, DateTimeKind.Utc),
            CancellationToken.None);

        var badRequest = result.ShouldBeOfType<BadRequestObjectResult>();
        TestHttp.ToJson(badRequest.Value).GetProperty("error").GetString()
            .ShouldBe("Query parameter 'from' must be less than or equal to 'to'.");
    }
}
