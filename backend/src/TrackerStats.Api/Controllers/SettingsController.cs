using Microsoft.AspNetCore.Mvc;
using TrackerStats.Domain.Services;

namespace TrackerStats.Api.Controllers;

[ApiController]
[Route("api/settings")]
public sealed class SettingsController(
    IApplicationSettingsService settingsService) : ControllerBase
{
    [HttpGet]
    public IActionResult Get()
    {
        var settings = settingsService.GetRequired();
        return Ok(new { userAgent = settings.UserAgent });
    }

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] UpdateSettingsRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.UserAgent))
            return BadRequest(new { error = "User-Agent must not be empty." });

        var settings = await settingsService.UpdateUserAgentAsync(request.UserAgent, ct);
        return Ok(new { userAgent = settings.UserAgent });
    }

    public sealed record UpdateSettingsRequest(string UserAgent);
}
