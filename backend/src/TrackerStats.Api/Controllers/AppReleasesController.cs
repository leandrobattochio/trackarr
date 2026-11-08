using Microsoft.AspNetCore.Mvc;
using TrackerStats.Infrastructure.Releases;

namespace TrackerStats.Api.Controllers;

[ApiController]
[Route("api/app-releases")]
public sealed class AppReleasesController(AppReleaseService releaseService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string? since, CancellationToken ct)
    {
        if (since is not null && !AppReleaseService.IsValidVersion(since))
            return BadRequest(new { error = $"'{since}' is not a semantic version such as 0.4.0." });

        return Ok(ToResponse(await releaseService.GetReportAsync(since, ct)));
    }

    internal static object ToResponse(AppReleaseReport report) =>
        new
        {
            status = report.Status == AppReleaseStatus.Available ? "available" : "unavailable",
            installedVersion = report.InstalledVersion,
            latestRelease = report.LatestRelease,
            updateAvailable = report.UpdateAvailable,
            releases = report.Releases,
            checkedAt = report.CheckedAt,
            error = report.Error
        };
}
