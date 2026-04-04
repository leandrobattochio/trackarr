using Microsoft.AspNetCore.Mvc;
using TrackerStats.Domain.Plugins;

namespace TrackerStats.Api.Controllers;

[ApiController]
[Route("api/plugins")]
public class PluginsController(ITrackerPluginRegistry registry) : ControllerBase
{
    [HttpGet]
    public IActionResult GetAll()
    {
        var plugins = registry.GetAll().Select(p => new
        {
            pluginId = p.PluginId,
            pluginGroup = p.PluginGroup,
            displayName = p.DisplayName,
            fields = p.Fields.Select(f => new
            {
                name = f.Name,
                label = f.Label,
                type = f.Type,
                required = f.Required,
                sensitive = f.Sensitive
            })
        });

        return Ok(plugins);
    }
}
