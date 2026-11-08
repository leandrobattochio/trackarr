using Microsoft.AspNetCore.Mvc;
using TrackerStats.Api.Metrics;

namespace TrackerStats.Api.Controllers;

[ApiController]
[Route("metrics")]
[ApiExplorerSettings(IgnoreApi = true)]
public sealed class MetricsController(TrackerMetricsWriter metricsWriter) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct) =>
        Content(await metricsWriter.WriteAsync(ct), TrackerMetricsWriter.ContentType);
}
