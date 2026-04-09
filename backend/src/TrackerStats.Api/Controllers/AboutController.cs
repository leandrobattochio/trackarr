using Microsoft.AspNetCore.Mvc;
using TrackerStats.Domain.Services;

namespace TrackerStats.Api.Controllers;

[ApiController]
[Route("api/about")]
public sealed class AboutController(IAboutService aboutService) : ControllerBase
{
    [HttpGet]
    public IActionResult Get()
    {
        var about = aboutService.Get();
        return Ok(new
        {
            version = about.Version,
            dotNetVersion = about.DotNetVersion,
            runningInDocker = about.RunningInDocker,
            databaseEngine = about.DatabaseEngine,
            appliedMigrations = about.AppliedMigrations,
            appDataDirectory = about.AppDataDirectory,
            startupDirectory = about.StartupDirectory,
            environmentName = about.EnvironmentName,
            uptime = about.Uptime
        });
    }
}
