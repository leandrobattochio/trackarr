using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using TrackerStats.Domain.Entities;
using TrackerStats.Domain.Plugins;
using TrackerStats.Domain.Repositories;
using TrackerStats.Infrastructure.Plugins.Yaml;
using YamlDotNet.Core;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace TrackerStats.Api.Controllers;

[ApiController]
[Route("api/plugins")]
public class PluginsController(
    ITrackerPluginRegistry registry,
    IYamlPluginDefinitionLoader loader,
    IPluginDefinitionRepository repository) : ControllerBase
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private static readonly IDeserializer Deserializer = new DeserializerBuilder()
        .WithNamingConvention(CamelCaseNamingConvention.Instance)
        .IgnoreUnmatchedProperties()
        .Build();

    private static readonly ISerializer Serializer = new SerializerBuilder()
        .WithNamingConvention(CamelCaseNamingConvention.Instance)
        .ConfigureDefaultValuesHandling(DefaultValuesHandling.OmitNull)
        .Build();

    [HttpGet]
    public IActionResult GetAll()
    {
        var plugins = registry.GetCatalog().Select(p => new
        {
            pluginId = p.PluginId,
            pluginGroup = p.PluginGroup,
            displayName = p.DisplayName,
            source = p.Source,
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

    [HttpGet("{pluginId}")]
    public IActionResult GetByPluginId(string pluginId)
    {
        var loadedDefinition = loader.LoadDefinitions()
            .FirstOrDefault(definition => string.Equals(definition.Definition.PluginId, pluginId, StringComparison.OrdinalIgnoreCase));

        if (loadedDefinition is null)
            return NotFound();

        var yaml = Serializer.Serialize(loadedDefinition.Definition);
        return Content(yaml, "application/yaml");
    }

    [HttpPost]
    public async Task<IActionResult> Create(CancellationToken ct)
    {
        var yaml = await ReadRequestBodyAsync(ct);
        var parseResult = ParseDefinition(yaml);
        if (parseResult.Error is not null)
            return BadRequest(new { error = parseResult.Error });

        var definition = parseResult.Definition!;

        if (registry.GetById(definition.PluginId) is not null)
            return Conflict(new { error = $"Plugin '{definition.PluginId}' already exists." });

        var now = DateTime.UtcNow;
        await repository.AddAsync(new PluginDefinition
        {
            Id = Guid.NewGuid(),
            PluginId = definition.PluginId,
            DefinitionJson = JsonSerializer.Serialize(definition, JsonOptions),
            CreatedAt = now,
            UpdatedAt = now
        }, ct);

        return CreatedAtAction(nameof(GetByPluginId), new { pluginId = definition.PluginId }, null);
    }

    [HttpPut("{pluginId}")]
    public async Task<IActionResult> Update(string pluginId, CancellationToken ct)
    {
        var existingCatalogEntry = registry.GetCatalog()
            .FirstOrDefault(plugin => string.Equals(plugin.PluginId, pluginId, StringComparison.OrdinalIgnoreCase));

        if (existingCatalogEntry is null)
            return NotFound();

        var yaml = await ReadRequestBodyAsync(ct);
        var parseResult = ParseDefinition(yaml);
        if (parseResult.Error is not null)
            return BadRequest(new { error = parseResult.Error });

        var definition = parseResult.Definition!;
        if (!string.Equals(definition.PluginId, pluginId, StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "Plugin ID in YAML must match the route parameter." });

        var storedDefinition = await repository.GetByPluginIdAsync(pluginId, ct);
        var now = DateTime.UtcNow;

        if (storedDefinition is null)
        {
            await repository.AddAsync(new PluginDefinition
            {
                Id = Guid.NewGuid(),
                PluginId = definition.PluginId,
                DefinitionJson = JsonSerializer.Serialize(definition, JsonOptions),
                CreatedAt = now,
                UpdatedAt = now
            }, ct);

            return Ok(new { pluginId = definition.PluginId, source = "database" });
        }

        storedDefinition.DefinitionJson = JsonSerializer.Serialize(definition, JsonOptions);
        storedDefinition.UpdatedAt = now;
        await repository.UpdateAsync(storedDefinition, ct);

        return Ok(new { pluginId = definition.PluginId, source = "database" });
    }

    [HttpDelete("{pluginId}")]
    public async Task<IActionResult> Delete(string pluginId, CancellationToken ct)
    {
        var storedDefinition = await repository.GetByPluginIdAsync(pluginId, ct);
        if (storedDefinition is null)
            return NotFound();

        await repository.DeleteAsync(storedDefinition.Id, ct);
        return NoContent();
    }

    private async Task<string> ReadRequestBodyAsync(CancellationToken ct)
    {
        using var reader = new StreamReader(Request.Body);
        return await reader.ReadToEndAsync(ct);
    }

    private static ParseDefinitionResult ParseDefinition(string yaml)
    {
        if (string.IsNullOrWhiteSpace(yaml))
            return new ParseDefinitionResult(null, "Request body must contain YAML.");

        try
        {
            var definition = Deserializer.Deserialize<TrackerStats.Domain.Plugins.Yaml.PluginDefinition>(yaml);
            if (definition is null)
                return new ParseDefinitionResult(null, "YAML could not be deserialized into a plugin definition.");

            var validationError = ValidateDefinition(definition);
            return validationError is null
                ? new ParseDefinitionResult(definition, null)
                : new ParseDefinitionResult(null, validationError);
        }
        catch (YamlException ex)
        {
            return new ParseDefinitionResult(null, $"Invalid YAML syntax: {ex.Message}");
        }
    }

    private static string? ValidateDefinition(TrackerStats.Domain.Plugins.Yaml.PluginDefinition definition)
    {
        if (string.IsNullOrWhiteSpace(definition.PluginId))
            return "Plugin definition is missing required field 'pluginId'.";

        if (string.IsNullOrWhiteSpace(definition.PluginGroup))
            return "Plugin definition is missing required field 'pluginGroup'.";

        if (string.IsNullOrWhiteSpace(definition.DisplayName))
            return "Plugin definition is missing required field 'displayName'.";

        if (definition.Fields is null)
            return "Plugin definition is missing required field 'fields'.";

        if (definition.Steps is null || definition.Steps.Count == 0)
            return "Plugin definition is missing required field 'steps'.";

        if (definition.Fields.Any(field => string.IsNullOrWhiteSpace(field.Name)))
            return "Each field must define 'name'.";

        if (definition.Fields.Any(field => string.IsNullOrWhiteSpace(field.Label)))
            return "Each field must define 'label'.";

        if (definition.Fields.Any(field => string.IsNullOrWhiteSpace(field.Type)))
            return "Each field must define 'type'.";

        if (definition.Steps.Any(step => string.IsNullOrWhiteSpace(step.Name)))
            return "Each step must define 'name'.";

        if (definition.Steps.Any(step => string.IsNullOrWhiteSpace(step.Method)))
            return "Each step must define 'method'.";

        if (definition.Steps.Any(step => string.IsNullOrWhiteSpace(step.Url)))
            return "Each step must define 'url'.";

        if (definition.Steps.Any(step => string.IsNullOrWhiteSpace(step.ResponseType)))
            return "Each step must define 'responseType'.";

        return null;
    }

    private sealed record ParseDefinitionResult(TrackerStats.Domain.Plugins.Yaml.PluginDefinition? Definition, string? Error);
}
