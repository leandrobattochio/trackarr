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

        var result = await controller.List(null, null, null, CancellationToken.None);

        var badRequest = result.ShouldBeOfType<BadRequestObjectResult>();
        TestHttp.ToJson(badRequest.Value).GetProperty("error").GetString().ShouldBe("Query parameter 'integrationId' is required.");
    }

    [Fact]
    public async Task List_should_return_not_found_when_integration_does_not_exist()
    {
        var controller = new SnapshotsController(new InMemoryIntegrationRepository(), new InMemoryIntegrationSnapshotRepository());

        var result = await controller.List(Guid.NewGuid(), null, null, CancellationToken.None);

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
            CapturedAt = new DateTime(2026, 4, 5, 12, 0, 0, DateTimeKind.Unspecified),
            Ratio = 1.5m,
            ActiveTorrents = 3
        });
        var controller = new SnapshotsController(repository, snapshots);

        var result = await controller.List(integrationId, null, null, CancellationToken.None);

        var ok = result.ShouldBeOfType<OkObjectResult>();
        var json = TestHttp.ToJson(ok.Value);
        json.GetProperty("integrationId").GetGuid().ShouldBe(integrationId);
        json.GetProperty("items").GetArrayLength().ShouldBe(1);
        json.GetProperty("items")[0].GetProperty("ratio").GetDecimal().ShouldBe(1.5m);
        json.GetProperty("items")[0].GetProperty("activeTorrents").GetInt32().ShouldBe(3);
        json.GetProperty("items")[0].GetProperty("capturedAt").GetDateTime().Kind.ShouldBe(DateTimeKind.Utc);
    }
}
