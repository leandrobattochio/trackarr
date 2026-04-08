using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Hosting;
using YamlDotNet.Core;
using TrackerStats.Domain.Plugins.Yaml;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace TrackerStats.Api.Controllers;

[ApiController]
[Route("api/plugins")]
public class PluginsController(
    IYamlPluginDefinitionLoader loader,
    IConfiguration configuration,
    IHostEnvironment? hostEnvironment = null) : ControllerBase
{
    private static readonly IDeserializer Deserializer = new DeserializerBuilder()
        .WithNamingConvention(CamelCaseNamingConvention.Instance)
        .Build();

    private static readonly ISerializer Serializer = new SerializerBuilder()
        .WithNamingConvention(CamelCaseNamingConvention.Instance)
        .ConfigureDefaultValuesHandling(DefaultValuesHandling.OmitNull)
        .Build();

    [HttpGet]
    public IActionResult GetAll()
    {
        var plugins = loader.LoadDefinitions().Select(plugin => new
        {
            pluginId = plugin.PluginId,
            displayName = plugin.DisplayName,
            definitionValid = plugin.IsValid,
            definitionError = plugin.Error,
            baseUrls = plugin.Definition is null ? Enumerable.Empty<string>() : plugin.Definition.BaseUrls,
            dashboard = plugin.Definition is null
                ? null
                : new
                {
                    byteUnitSystem = plugin.Definition.Dashboard.ByteUnitSystem,
                    metrics = plugin.Definition.Dashboard.Metrics.Select(metric => new
                    {
                        stat = metric.Stat,
                        label = metric.Label,
                        format = metric.Format,
                        icon = metric.Icon,
                        tone = metric.Tone
                    }).ToList()
                },
            fields = plugin.Definition is null
                ? Enumerable.Empty<object>()
                : plugin.Definition.Fields.Select(f => (object)new
                {
                    name = f.Name,
                    label = f.Label,
                    type = f.Type,
                    required = f.Required,
                    sensitive = f.Sensitive
                }),
            customFields = plugin.Definition is null
                ? Enumerable.Empty<object>()
                : plugin.Definition.CustomFields.Select(f => (object)new
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
            .FirstOrDefault(definition => string.Equals(definition.PluginId, pluginId, StringComparison.OrdinalIgnoreCase));

        if (loadedDefinition is null)
            return NotFound();

        if (!loadedDefinition.IsValid)
            return Content(loadedDefinition.RawContent, "application/yaml");

        var editableDefinition = PluginDefinitionDefaults.CreateEditableDefinition(loadedDefinition.Definition!);
        var yaml = Serializer.Serialize(editableDefinition);
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
        if (FindPluginPath(definition.PluginId) is not null)
            return Conflict(new { error = $"Plugin '{definition.PluginId}' already exists." });

        var pluginsDirectory = ResolvePluginsDirectory();
        Directory.CreateDirectory(pluginsDirectory);

        var targetPath = Path.Combine(pluginsDirectory, $"{definition.PluginId}.yaml");
        await System.IO.File.WriteAllTextAsync(targetPath, yaml, ct);

        return CreatedAtAction(nameof(GetByPluginId), new { pluginId = definition.PluginId }, new
        {
            pluginId = definition.PluginId
        });
    }

    [HttpPut("{pluginId}")]
    public async Task<IActionResult> Update(string pluginId, CancellationToken ct)
    {
        var existingPath = FindPluginPath(pluginId);
        if (existingPath is null)
            return NotFound();

        var yaml = await ReadRequestBodyAsync(ct);
        var parseResult = ParseDefinition(yaml);
        if (parseResult.Error is not null)
            return BadRequest(new { error = parseResult.Error });

        var definition = parseResult.Definition!;
        if (!string.Equals(definition.PluginId, pluginId, StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "Plugin ID in YAML must match the route parameter." });

        await System.IO.File.WriteAllTextAsync(existingPath, yaml, ct);
        return Ok(new { pluginId = definition.PluginId });
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
            var definition = Deserializer.Deserialize<PluginDefinition>(yaml);
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

    private static string? ValidateDefinition(PluginDefinition definition)
    {
        if (string.IsNullOrWhiteSpace(definition.PluginId))
            return "Plugin definition is missing required field 'pluginId'.";

        if (string.IsNullOrWhiteSpace(definition.DisplayName))
            return "Plugin definition is missing required field 'displayName'.";

        if (definition.Fields is null)
            return "Plugin definition is missing required field 'fields'.";

        definition.BaseUrls ??= [];
        definition.CustomFields ??= [];

        if (definition.BaseUrls.Count == 0 || definition.BaseUrls.Any(string.IsNullOrWhiteSpace))
            return "Plugin definition must define at least one valid 'baseUrls' entry.";

        if (definition.Steps is null || definition.Steps.Count == 0)
            return "Plugin definition is missing required field 'steps'.";

        var effectiveFields = PluginDefinitionDefaults.GetEffectiveFields(definition);

        if (effectiveFields.Any(field => string.IsNullOrWhiteSpace(field.Name)))
            return "Each field must define 'name'.";

        if (effectiveFields.Any(field => string.IsNullOrWhiteSpace(field.Label)))
            return "Each field must define 'label'.";

        if (effectiveFields.Any(field => string.IsNullOrWhiteSpace(field.Type)))
            return "Each field must define 'type'.";

        var reservedPropertyViolation = PluginDefinitionDefaults.GetReservedPropertyViolation(definition);
        if (reservedPropertyViolation is not null)
            return reservedPropertyViolation;

        if (definition.Steps.Any(step => string.IsNullOrWhiteSpace(step.Name)))
            return "Each step must define 'name'.";

        if (definition.Steps.Any(step => string.IsNullOrWhiteSpace(step.Method)))
            return "Each step must define 'method'.";

        if (definition.Steps.Any(step => string.IsNullOrWhiteSpace(step.Url)))
            return "Each step must define 'url'.";

        if (definition.Steps.Any(step => string.IsNullOrWhiteSpace(step.ResponseType)))
            return "Each step must define 'responseType'.";

        if (definition.Dashboard is null || definition.Dashboard.Metrics.Count == 0)
            return "Plugin definition must define at least one dashboard metric.";

        var allowedStats = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "ratio", "uploadedBytes", "downloadedBytes", "seedBonus", "buffer", "hitAndRuns",
            "requiredRatio", "seedingTorrents", "leechingTorrents", "activeTorrents"
        };

        var allowedFormats = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "bytes", "count", "text"
        };

        var allowedByteUnitSystems = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "binary", "decimal"
        };

        if (definition.Dashboard.Metrics.Any(metric => string.IsNullOrWhiteSpace(metric.Stat)))
            return "Each dashboard metric must define 'stat'.";

        if (definition.Dashboard.Metrics.Any(metric => string.IsNullOrWhiteSpace(metric.Label)))
            return "Each dashboard metric must define 'label'.";

        if (definition.Dashboard.Metrics.Any(metric => string.IsNullOrWhiteSpace(metric.Format)))
            return "Each dashboard metric must define 'format'.";

        if (definition.Dashboard.Metrics.Any(metric => !allowedStats.Contains(metric.Stat)))
            return "Dashboard metrics contain an unsupported 'stat' value.";

        if (definition.Dashboard.Metrics.Any(metric => !allowedFormats.Contains(metric.Format)))
            return "Dashboard metrics contain an unsupported 'format' value.";

        if (!string.IsNullOrWhiteSpace(definition.Dashboard.ByteUnitSystem)
            && !allowedByteUnitSystems.Contains(definition.Dashboard.ByteUnitSystem))
            return "Dashboard config contains an unsupported 'byteUnitSystem' value.";

        return null;
    }

    private string? FindPluginPath(string pluginId)
    {
        var pluginsDirectory = ResolvePluginsDirectory();
        if (!Directory.Exists(pluginsDirectory))
            return null;

        var directPath = Path.Combine(pluginsDirectory, $"{pluginId}.yaml");
        if (System.IO.File.Exists(directPath))
            return directPath;

        foreach (var path in Directory.EnumerateFiles(pluginsDirectory, "*.yaml", SearchOption.TopDirectoryOnly))
        {
            try
            {
                var content = System.IO.File.ReadAllText(path);
                var yamlPluginId = TryExtractScalar(content, "pluginId");
                if (string.Equals(yamlPluginId, pluginId, StringComparison.OrdinalIgnoreCase))
                    return path;
            }
            catch
            {
            }
        }

        return null;
    }

    private string ResolvePluginsDirectory()
    {
        var configuredDirectory = configuration["Plugins:Directory"];
        if (!string.IsNullOrWhiteSpace(configuredDirectory))
            return ResolvePath(configuredDirectory);

        throw new InvalidOperationException("Plugins directory is not configured. Set 'Plugins:Directory'.");
    }

    private string ResolvePath(string path) =>
        Path.IsPathRooted(path)
            ? path
            : Path.GetFullPath(Path.Combine(GetBasePath(), path));

    private string GetBasePath() =>
        string.IsNullOrWhiteSpace(hostEnvironment?.ContentRootPath)
            ? AppContext.BaseDirectory
            : hostEnvironment.ContentRootPath;

    private static string? TryExtractScalar(string content, string key)
    {
        foreach (var rawLine in content.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries))
        {
            var line = rawLine.Trim();
            if (!line.StartsWith($"{key}:", StringComparison.Ordinal))
                continue;

            var value = line[(key.Length + 1)..].Trim().Trim('"', '\'');
            return string.IsNullOrWhiteSpace(value) ? null : value;
        }

        return null;
    }

    private sealed record ParseDefinitionResult(PluginDefinition? Definition, string? Error);
}
