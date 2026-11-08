using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using TrackerStats.Domain.Repositories;
using TrackerStats.Infrastructure.Plugins;

namespace TrackerStats.Api.Controllers;

public sealed record PluginTestRequest(Guid? IntegrationId, string? Yaml, bool UseOfficial);

[ApiController]
[Route("api/plugins/test")]
public class PluginTestController(IIntegrationRepository integrations, PluginDryRunService dryRun) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Test([FromBody] PluginTestRequest request, CancellationToken ct)
    {
        if (request.IntegrationId is not { } integrationId || integrationId == Guid.Empty)
            return BadRequest(new { error = "integrationId is required." });

        var hasYaml = !string.IsNullOrWhiteSpace(request.Yaml);
        if (hasYaml == request.UseOfficial)
            return BadRequest(new { error = "Send either yaml or useOfficial: true." });

        var integration = await integrations.GetByIdAsync(integrationId, ct);
        if (integration is null)
            return NotFound(new { error = $"Integration '{integrationId}' not found." });

        var outcome = await dryRun.RunAsync(integration, request.Yaml, request.UseOfficial, ct);
        if (outcome.Report is not { } report)
            return outcome.Rejection == PluginDryRunRejection.NotFound
                ? NotFound(new { error = outcome.Error })
                : BadRequest(new { error = outcome.Error });

        return Ok(new
        {
            outcome = JsonNamingPolicy.CamelCase.ConvertName(report.Result.ToString()),
            steps = report.Steps.Select(step => new
            {
                name = step.Name,
                method = step.Method,
                path = step.Path,
                statusCode = step.StatusCode
            }),
            stats = report.Stats,
            failedField = report.FailedField is { } field
                ? new { step = field.Step, field = field.Field, error = field.Error }
                : null,
            error = report.Error
        });
    }
}
