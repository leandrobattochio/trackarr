using Microsoft.AspNetCore.Mvc;
using TrackerStats.Domain.Repositories;

namespace TrackerStats.Api.Controllers;

[ApiController]
[Route("api/snapshots")]
public class SnapshotsController(
    IIntegrationRepository integrationRepository,
    IIntegrationSnapshotRepository snapshotRepository)
    : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] Guid? integrationId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken ct)
    {
        if (!integrationId.HasValue)
            return BadRequest(new { error = "Query parameter 'integrationId' is required." });

        var integration = await integrationRepository.GetByIdAsync(integrationId.Value, ct);
        if (integration is null)
            return NotFound(new { error = "Integration not found." });

        var snapshots = await snapshotRepository.ListByIntegrationAsync(integrationId.Value, from, to, ct);

        return Ok(new
        {
            integrationId = integration.Id,
            from = NormalizeUtc(from),
            to = NormalizeUtc(to),
            items = snapshots.Select(snapshot => new
            {
                id = snapshot.Id,
                integrationId = snapshot.IntegrationId,
                capturedAt = NormalizeUtc(snapshot.CapturedAt),
                uploadedBytes = snapshot.UploadedBytes,
                downloadedBytes = snapshot.DownloadedBytes,
                seedBonus = snapshot.SeedBonus,
                buffer = snapshot.Buffer,
                hitAndRuns = snapshot.HitAndRuns,
                ratio = snapshot.Ratio,
                requiredRatio = snapshot.RequiredRatio,
                seedingTorrents = snapshot.SeedingTorrents,
                leechingTorrents = snapshot.LeechingTorrents,
                activeTorrents = snapshot.ActiveTorrents
            })
        });
    }

    private static DateTime? NormalizeUtc(DateTime? value) =>
        value.HasValue ? DateTime.SpecifyKind(value.Value, DateTimeKind.Utc) : null;
}
