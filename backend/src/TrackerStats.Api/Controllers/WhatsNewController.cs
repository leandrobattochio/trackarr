using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using TrackerStats.Infrastructure.WhatsNew;

namespace TrackerStats.Api.Controllers;

[ApiController]
[Route("api/whats-new")]
public sealed class WhatsNewController(WhatsNewService whatsNewService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var report = await whatsNewService.GetAsync(ct);
        return Ok(new
        {
            shouldAutoOpen = report.ShouldAutoOpen,
            lastReadAppVersion = report.LastReadAppVersion,
            lastReadPluginChangeId = report.LastReadPluginChangeId,
            lastReadAt = report.LastReadAt,
            app = AppReleasesController.ToResponse(report.App),
            pluginUpdates = report.PluginUpdates
        });
    }

    [HttpPost("read")]
    public async Task<IActionResult> MarkRead(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] WhatsNewReadRequest? body,
        CancellationToken ct)
    {
        await whatsNewService.MarkReadAsync(body?.PluginChangeId, body?.AppVersion, ct);
        return NoContent();
    }
}

public sealed record WhatsNewReadRequest(long? PluginChangeId, string? AppVersion = null);
