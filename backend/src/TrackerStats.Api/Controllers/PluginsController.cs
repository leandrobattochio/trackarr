using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using TrackerStats.Domain.Plugins.Yaml;
using TrackerStats.Domain.Repositories;
using TrackerStats.Infrastructure.Plugins.Storage;
using TrackerStats.Infrastructure.Plugins.Yaml;

namespace TrackerStats.Api.Controllers;

[ApiController]
[Route("api/plugins")]
public class PluginsController(
    IYamlPluginDefinitionLoader loader,
    PluginStorageLayout layout,
    PluginOverrideService overrides,
    PluginStateStore stateStore,
    PluginStatusService statuses,
    IIntegrationRepository integrations) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var plugins = statuses.GetStatuses(await integrations.ListAsync(ct)).Select(status =>
        {
            var definition = status.Loaded?.Definition;
            return new
            {
                pluginId = status.PluginId,
                displayName = status.DisplayName,
                definitionValid = status.Loaded?.IsValid ?? false,
                definitionError = status.Loaded is null ? status.Incompatibility?.Message : status.Loaded.Error,
                origin = ToApiOrigin(status.Origin),
                version = status.Version,
                baseVersion = status.BaseVersion,
                latestOfficialVersion = status.LatestOfficialVersion,
                outdated = status.Outdated,
                orphan = status.Orphan,
                deprecated = status.Deprecated,
                incompatible = status.Incompatible,
                incompatibleVersion = status.Incompatibility?.Version,
                requiredSchemaVersion = status.Incompatibility?.RequiredSchemaVersion,
                requiredAppVersion = status.Incompatibility?.RequiredAppVersion,
                incompatibleMessage = status.Incompatibility?.Message,
                hiddenOfficial = status.HiddenOfficial,
                lastSyncFailed = status.LastSyncFailed,
                baseUrls = definition is null ? Enumerable.Empty<string>() : definition.BaseUrls,
                dashboard = definition is null
                    ? null
                    : new
                    {
                        byteUnitSystem = definition.Dashboard.ByteUnitSystem,
                        metrics = definition.Dashboard.Metrics.Select(metric => new
                        {
                            stat = metric.Stat,
                            label = metric.Label,
                            format = metric.Format,
                            icon = metric.Icon,
                            tone = metric.Tone
                        }).ToList()
                    },
                fields = definition is null ? [] : definition.Fields.Select(ToApiField).ToList(),
                customFields = definition is null ? [] : definition.CustomFields.Select(ToApiField).ToList()
            };
        });

        return Ok(plugins);
    }

    [HttpGet("{pluginId}/diff")]
    public IActionResult GetDiff(string pluginId)
    {
        if (!PluginSchema.IsValidPluginId(pluginId))
            return InvalidPluginId(pluginId);

        var diff = statuses.GetDiff(pluginId);
        if (diff is null)
            return NotFound(new { error = $"Plugin '{pluginId}' not found." });

        return Ok(new
        {
            pluginId = diff.PluginId,
            origin = ToApiOrigin(diff.Origin),
            baseVersion = diff.BaseVersion,
            latestOfficialVersion = diff.LatestOfficialVersion,
            @base = diff.Base,
            yours = diff.Yours,
            latestOfficial = diff.LatestOfficial,
            changelog = diff.Changelog
        });
    }

    [HttpGet("{pluginId}")]
    public IActionResult GetByPluginId(string pluginId)
    {
        if (!PluginSchema.IsValidPluginId(pluginId))
            return InvalidPluginId(pluginId);

        var loadedDefinition = FindEffectiveDefinition(pluginId);
        if (loadedDefinition is null)
            return NotFound();

        return Content(loadedDefinition.RawContent, "application/yaml");
    }

    [HttpPost]
    public async Task<IActionResult> Create(CancellationToken ct)
    {
        var yaml = await ReadRequestBodyAsync(ct);
        var validation = PluginDefinitionValidator.Validate(yaml, requireSchemaVersion: true);
        if (validation.Error is not null)
            return BadRequest(new { error = validation.Error });

        var definition = validation.Definition!;
        var existing = loader.LoadAllDefinitions()
            .Where(plugin => string.Equals(plugin.PluginId, definition.PluginId, StringComparison.OrdinalIgnoreCase))
            .ToList();

        if (IsOfficialId(definition.PluginId, existing))
            return Conflict(new
            {
                error = $"Plugin id '{definition.PluginId}' belongs to an official plugin, so a custom plugin cannot use it. " +
                        "Choose another id, or edit the official plugin to keep your own copy of it."
            });

        if (existing.Count > 0)
            return Conflict(new { error = $"Plugin '{definition.PluginId}' already exists." });

        var targetPath = layout.GetPluginPath(PluginOrigin.Custom, definition.PluginId);
        Directory.CreateDirectory(layout.CustomDirectory);
        await System.IO.File.WriteAllTextAsync(targetPath, yaml, ct);

        return CreatedAtAction(nameof(GetByPluginId), new { pluginId = definition.PluginId }, new
        {
            pluginId = definition.PluginId
        });
    }

    [HttpPut("{pluginId}")]
    public async Task<IActionResult> Update(string pluginId, CancellationToken ct)
    {
        if (!PluginSchema.IsValidPluginId(pluginId))
            return InvalidPluginId(pluginId);

        var existing = FindEffectiveDefinition(pluginId);
        if (existing is null)
            return NotFound();

        var yaml = await ReadRequestBodyAsync(ct);
        var validation = PluginDefinitionValidator.Validate(yaml, requireSchemaVersion: existing.Origin == PluginOrigin.Custom);
        if (validation.Error is not null)
            return BadRequest(new { error = validation.Error });

        var definition = validation.Definition!;
        if (!string.Equals(definition.PluginId, pluginId, StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "Plugin ID in YAML must match the route parameter." });

        if (existing.Origin == PluginOrigin.Custom)
        {
            await System.IO.File.WriteAllTextAsync(layout.GetPluginPath(PluginOrigin.Custom, definition.PluginId), yaml, ct);
            return Ok(new { pluginId = definition.PluginId, origin = "custom" });
        }

        var outcome = overrides.SaveOfficialEdit(definition.PluginId, yaml);
        return Ok(new
        {
            pluginId = definition.PluginId,
            origin = outcome == PluginOverrideSaveOutcome.Saved ? "override" : "official"
        });
    }

    [HttpDelete("{pluginId}")]
    public async Task<IActionResult> Delete(string pluginId, CancellationToken ct)
    {
        if (!PluginSchema.IsValidPluginId(pluginId))
            return InvalidPluginId(pluginId);

        var customPath = layout.GetPluginPath(PluginOrigin.Custom, pluginId);
        if (!System.IO.File.Exists(customPath))
        {
            var isOfficial = loader.LoadAllDefinitions()
                .Any(plugin => plugin.Origin != PluginOrigin.Custom
                               && string.Equals(plugin.PluginId, pluginId, StringComparison.OrdinalIgnoreCase));
            return isOfficial
                ? BadRequest(new { error = $"Plugin '{pluginId}' is official and cannot be deleted. Only custom plugins can be deleted." })
                : NotFound(new { error = $"Plugin '{pluginId}' not found." });
        }

        var usedBy = (await integrations.ListAsync(ct))
            .Where(integration => string.Equals(integration.PluginId, pluginId, StringComparison.OrdinalIgnoreCase))
            .ToList();
        if (usedBy.Count > 0)
            return Conflict(new
            {
                error = $"Plugin '{pluginId}' is used by {usedBy.Count} integration(s). Delete them first.",
                integrations = usedBy.Select(integration => new
                {
                    id = integration.Id,
                    url = ReadBaseUrl(integration.Payload)
                })
            });

        System.IO.File.Delete(customPath);
        return NoContent();
    }

    [HttpDelete("{pluginId}/override")]
    public IActionResult DeleteOverride(string pluginId)
    {
        if (!PluginSchema.IsValidPluginId(pluginId))
            return InvalidPluginId(pluginId);

        return overrides.DeleteOverride(pluginId)
            ? NoContent()
            : NotFound(new { error = $"Plugin '{pluginId}' has no override." });
    }

    private LoadedYamlPluginDefinition? FindEffectiveDefinition(string pluginId) =>
        loader.LoadDefinitions()
            .FirstOrDefault(definition => string.Equals(definition.PluginId, pluginId, StringComparison.OrdinalIgnoreCase));

    // Ids only in state.json count too, so an official that is not installed stays reserved.
    private bool IsOfficialId(string pluginId, IEnumerable<LoadedYamlPluginDefinition> files)
    {
        if (files.Any(plugin => plugin.Origin != PluginOrigin.Custom))
            return true;

        var state = stateStore.Load();
        return state.Official.ContainsKey(pluginId) || state.Index?.Plugins.ContainsKey(pluginId) == true;
    }

    private static string ToApiOrigin(PluginOrigin origin) => origin switch
    {
        PluginOrigin.Override => "override",
        PluginOrigin.Custom => "custom",
        _ => "official"
    };

    private static object ToApiField(FieldDefinition field) => new
    {
        name = field.Name,
        label = field.Label,
        description = field.Description,
        type = field.Type,
        required = field.Required,
        sensitive = field.Sensitive
    };

    private static string? ReadBaseUrl(string payload)
    {
        try
        {
            using var document = JsonDocument.Parse(payload);
            return document.RootElement.ValueKind == JsonValueKind.Object
                   && document.RootElement.TryGetProperty("baseUrl", out var baseUrl)
                   && baseUrl.ValueKind == JsonValueKind.String
                ? baseUrl.GetString()
                : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private BadRequestObjectResult InvalidPluginId(string pluginId) =>
        BadRequest(new { error = PluginSchema.GetInvalidPluginIdMessage(pluginId) });

    private async Task<string> ReadRequestBodyAsync(CancellationToken ct)
    {
        using var reader = new StreamReader(Request.Body);
        return await reader.ReadToEndAsync(ct);
    }
}
