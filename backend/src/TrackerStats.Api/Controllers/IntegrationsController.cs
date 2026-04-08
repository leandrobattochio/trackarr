using System.Text.Json;
using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using TrackerStats.Domain.Entities;
using TrackerStats.Domain.Plugins;
using TrackerStats.Domain.Repositories;
using TrackerStats.Infrastructure.Services;

namespace TrackerStats.Api.Controllers;

[ApiController]
[Route("api/integrations")]
public class IntegrationsController(
    IIntegrationRepository repository,
    IIntegrationSnapshotRepository snapshotRepository,
    ITrackerPluginRegistry registry,
    ITrackerPluginHttpClientFactory httpClientFactory,
    IntegrationConfigurationValidator configurationValidator,
    IntegrationSyncService syncService,
    IntegrationRecurringJobScheduler recurringJobScheduler,
    IValidator<CreateIntegrationRequest> createValidator,
    IValidator<UpdateIntegrationRequest> updateValidator)
    : ControllerBase
{
    private static readonly JsonSerializerOptions _jsonOpts = new() { PropertyNameCaseInsensitive = true };
    private const string SensitiveMask = "*****";

    private readonly ITrackerPluginHttpClientFactory _httpClientFactory = httpClientFactory;

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var integrations = await repository.ListAsync(ct);
        return Ok(integrations.Select(integration =>
        {
            var validation = configurationValidator.Validate(integration);
            return ToResponse(integration, recurringJobScheduler.GetNextExecutionUtc(integration.Id), validation);
        }));
    }

    [HttpPost("{id:guid}/sync")]
    public async Task<IActionResult> Sync(Guid id, CancellationToken ct)
    {
        var outcome = await syncService.SyncAsync(id, ct);
        if (!outcome.WasFound)
            return NotFound();

        if (!outcome.PluginExists || outcome.Integration is null)
            return BadRequest(new { error = $"Plugin '{outcome.Integration?.PluginId ?? "unknown"}' not found." });

        if (!outcome.ConfigurationIsValid)
            return BadRequest(new { error = outcome.ConfigurationError ?? "Integration configuration is invalid." });

        var validation = configurationValidator.Validate(outcome.Integration);
        return Ok(ToResponse(outcome.Integration, recurringJobScheduler.GetNextExecutionUtc(outcome.Integration.Id), validation));
    }

    [HttpGet("{id:guid}/snapshots")]
    public async Task<IActionResult> GetSnapshots(Guid id, [FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct)
    {
        var integration = await repository.GetByIdAsync(id, ct);
        if (integration is null)
            return NotFound();

        var snapshots = await snapshotRepository.ListByIntegrationAsync(id, from, to, ct);

        return Ok(snapshots.Select(s => new
        {
            id = s.Id,
            capturedAt = s.CapturedAt,
            ratio = s.Ratio,
            uploadedBytes = s.UploadedBytes,
            downloadedBytes = s.DownloadedBytes,
            seedBonus = s.SeedBonus,
            buffer = s.Buffer,
            hitAndRuns = s.HitAndRuns,
            requiredRatio = s.RequiredRatio,
            seedingTorrents = s.SeedingTorrents,
            activeTorrents = s.ActiveTorrents
        }));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var integration = await repository.GetByIdAsync(id, ct);
        if (integration is null)
            return NotFound();

        await repository.DeleteAsync(id, ct);
        recurringJobScheduler.Remove(id);
        return NoContent();
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateIntegrationRequest request, CancellationToken ct)
    {
        var integration = await repository.GetByIdAsync(id, ct);
        if (integration is null)
            return NotFound();

        if (!string.Equals(integration.PluginId, request.PluginId, StringComparison.Ordinal))
            return BadRequest(new { error = "PluginId cannot be changed for an existing integration." });

        var validationError = await ValidateRequestAsync(updateValidator, request, ct);
        if (validationError is not null)
            return validationError;

        var plugin = registry.GetById(request.PluginId)!;
        var mergedPayload = MergeSensitiveFields(plugin, integration.Payload, request.Payload);
        var validation = configurationValidator.Validate(request.PluginId, mergedPayload);
        if (!validation.IsValid)
            return BadRequest(new { error = validation.Error });

        integration.Payload = mergedPayload;
        integration.RequiredRatio = ParseRequiredRatio(mergedPayload);

        await repository.UpdateAsync(integration, ct);
        recurringJobScheduler.Schedule(integration);

        return Ok(ToResponse(integration, recurringJobScheduler.GetNextExecutionUtc(integration.Id), validation));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateIntegrationRequest request, CancellationToken ct)
    {
        var validationError = await ValidateRequestAsync(createValidator, request, ct);
        if (validationError is not null)
            return validationError;

        var validation = configurationValidator.Validate(request.PluginId, request.Payload);
        if (!validation.IsValid)
            return BadRequest(new { error = validation.Error });

        var integration = new Integration
        {
            Id = Guid.NewGuid(),
            PluginId = request.PluginId,
            Payload = request.Payload,
            RequiredRatio = ParseRequiredRatio(request.Payload)
        };

        await repository.AddAsync(integration, ct);
        recurringJobScheduler.Schedule(integration);

        return CreatedAtAction(nameof(Create), new { id = integration.Id }, ToResponse(integration, recurringJobScheduler.GetNextExecutionUtc(integration.Id), validation));
    }

    // ---------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------

    private static async Task<BadRequestObjectResult?> ValidateRequestAsync<TRequest>(
        IValidator<TRequest> validator,
        TRequest request,
        CancellationToken ct)
    {
        var result = await validator.ValidateAsync(request, ct);
        if (result.IsValid)
            return null;

        return new BadRequestObjectResult(new
        {
            error = string.Join(" ", result.Errors.Select(error => error.ErrorMessage).Distinct())
        });
    }

    private object ToResponse(Integration i, DateTime? nextAutomaticSyncAt, IntegrationConfigurationValidationResult validation)
    {
        var plugin = validation.Plugin;
        var payload = RemoveSensitiveFields(plugin, ParsePayload(i.Payload));
        var hasStats = i.Ratio.HasValue || i.UploadedBytes.HasValue || i.DownloadedBytes.HasValue;

        return new
        {
            id = i.Id,
            pluginId = i.PluginId,
            dashboard = plugin is null
                ? null
                : new
                {
                    byteUnitSystem = plugin.Dashboard.ByteUnitSystem,
                    metrics = plugin.Dashboard.Metrics.Select(metric => new
                    {
                        stat = metric.Stat,
                        label = metric.Label,
                        format = metric.Format,
                        icon = metric.Icon,
                        tone = metric.Tone
                    })
                },
            payload,
            url = payload.GetValueOrDefault("baseUrl"),
            requiredRatio = i.RequiredRatio,
            lastSyncAt = NormalizeUtc(i.LastSyncAt),
            nextAutomaticSyncAt = NormalizeUtc(nextAutomaticSyncAt),
            lastSyncResult = i.LastSyncResult is null ? null : ToSyncResult(i.LastSyncResult.Value),
            configurationValid = validation.IsValid,
            configurationError = validation.Error,
            stats = hasStats
                ? (object?)new
                {
                    ratio = i.Ratio,
                    uploadedBytes = i.UploadedBytes,
                    downloadedBytes = i.DownloadedBytes,
                    seedBonus = i.SeedBonus,
                    buffer = i.Buffer,
                    hitAndRuns = i.HitAndRuns,
                    requiredRatio = i.RequiredRatio,
                    seedingTorrents = i.SeedingTorrents,
                    leechingTorrents = i.LeechingTorrents,
                    activeTorrents = i.ActiveTorrents
                }
                : null
        };
    }

    private static DateTime? NormalizeUtc(DateTime? value) =>
        value.HasValue ? DateTime.SpecifyKind(value.Value, DateTimeKind.Utc) : null;

    private static decimal ParseRequiredRatio(string payload)
    {
        var dict = ParsePayload(payload);
        var requiredRatioRaw = dict.GetValueOrDefault("required_ratio");

        if (string.IsNullOrWhiteSpace(requiredRatioRaw))
            throw new InvalidOperationException("Payload is missing required field 'required_ratio'.");

        if (!decimal.TryParse(requiredRatioRaw, System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var requiredRatio))
            throw new InvalidOperationException("Payload field 'required_ratio' must be a valid decimal number.");

        return requiredRatio;
    }

    private static string ToSyncResult(PluginProcessResult result) =>
        result switch
        {
            PluginProcessResult.Success => "success",
            PluginProcessResult.AuthFailed => "authFailed",
            PluginProcessResult.UnknownError => "unknownError",
            _ => "unknownError"
        };

    private static Dictionary<string, string?> ParsePayload(string payload)
    {
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, string?>>(payload, _jsonOpts) ?? [];
        }
        catch
        {
            return [];
        }
    }

    private static string MergeSensitiveFields(ITrackerPlugin plugin, string existingPayloadJson, string incomingPayloadJson)
    {
        var existingPayload = ParsePayload(existingPayloadJson);
        var incomingPayload = ParsePayload(incomingPayloadJson);

        foreach (var field in plugin.Fields.Where(f => f.Sensitive))
        {
            var incomingValue = incomingPayload.GetValueOrDefault(field.Name);
            if (string.IsNullOrWhiteSpace(incomingValue) || string.Equals(incomingValue, SensitiveMask, StringComparison.Ordinal))
                incomingPayload[field.Name] = existingPayload.GetValueOrDefault(field.Name);
        }

        return JsonSerializer.Serialize(incomingPayload, _jsonOpts);
    }

    private static Dictionary<string, string?> RemoveSensitiveFields(ITrackerPlugin? plugin, Dictionary<string, string?> payload)
    {
        if (plugin is null)
            return payload;

        var sanitized = new Dictionary<string, string?>(payload, StringComparer.OrdinalIgnoreCase);

        foreach (var field in plugin.Fields.Where(f => f.Sensitive))
        {
            sanitized.Remove(field.Name);
        }

        return sanitized;
    }
}

public record CreateIntegrationRequest(string PluginId, string Payload);
public record UpdateIntegrationRequest(string PluginId, string Payload);
