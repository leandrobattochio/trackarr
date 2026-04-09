using Microsoft.AspNetCore.Mvc;
using TrackerStats.Domain.Services;

namespace TrackerStats.Api.Controllers;

[ApiController]
[Route("api/update-check")]
public sealed class UpdateCheckController(
    IApplicationVersionService versionService,
    IUpdateCheckService updateCheckService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var updateCheck = await updateCheckService.CheckAsync(versionService.GetVersion(), ct);
        return Ok(updateCheck);
    }
}
