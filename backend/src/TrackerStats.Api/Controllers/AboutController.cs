using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using TrackerStats.Domain.Services;
using TrackerStats.Infrastructure.Plugins.Storage;

namespace TrackerStats.Api.Controllers;

[ApiController]
[Route("api/about")]
public sealed class AboutController(IAboutService aboutService, PluginStateStore pluginStateStore) : ControllerBase
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
            databasePath = about.DatabasePath,
            appliedMigrations = about.AppliedMigrations,
            appDataDirectory = about.AppDataDirectory,
            startupDirectory = about.StartupDirectory,
            environmentName = about.EnvironmentName,
            uptime = about.Uptime
        });
    }

    [HttpGet("plugin-download")]
    public IActionResult GetPluginDownload()
    {
        var state = pluginStateStore.Load();
        var report = state.LastDownload;
        return Ok(new
        {
            lastDownload = report is null
                ? null
                : new
                {
                    startedAt = report.StartedAt,
                    completedAt = report.CompletedAt,
                    source = report.Source,
                    indexSha256 = report.IndexSha256,
                    succeeded = report.Succeeded,
                    error = report.Error,
                    plugins = report.Plugins.Select(plugin => new
                    {
                        pluginId = plugin.PluginId,
                        version = plugin.Version,
                        outcome = JsonNamingPolicy.CamelCase.ConvertName(plugin.Outcome.ToString()),
                        overridden = plugin.Overridden,
                        outdated = plugin.Outdated,
                        hiddenByCustom = plugin.HiddenByCustom,
                        message = plugin.Message
                    }),
                    bases = (report.Bases ?? []).Select(pluginBase => new
                    {
                        baseId = pluginBase.PluginId,
                        version = pluginBase.Version,
                        outcome = JsonNamingPolicy.CamelCase.ConvertName(pluginBase.Outcome.ToString()),
                        message = pluginBase.Message
                    })
                },
            lastSuccessfulIndex = state.Index is null
                ? null
                : new
                {
                    source = state.Index.Source,
                    sha256 = state.Index.Sha256,
                    fetchedAt = state.Index.FetchedAt
                }
        });
    }
}
