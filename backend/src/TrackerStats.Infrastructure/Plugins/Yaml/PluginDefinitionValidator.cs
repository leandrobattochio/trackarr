using TrackerStats.Domain.Plugins.Yaml;
using YamlDotNet.Core;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace TrackerStats.Infrastructure.Plugins.Yaml;

public sealed record PluginDefinitionValidationResult(PluginDefinition? Definition, string? Error)
{
    public bool IsValid => Error is null;
}

public static class PluginDefinitionValidator
{
    private static readonly IDeserializer Deserializer = new DeserializerBuilder()
        .WithNamingConvention(CamelCaseNamingConvention.Instance)
        .Build();

    private static readonly HashSet<string> AllowedStats = new(StringComparer.OrdinalIgnoreCase)
    {
        "ratio", "uploadedBytes", "downloadedBytes", "seedBonus", "buffer", "hitAndRuns",
        "requiredRatio", "seedingTorrents", "leechingTorrents", "activeTorrents"
    };

    private static readonly HashSet<string> AllowedFormats = new(StringComparer.OrdinalIgnoreCase)
    {
        "bytes", "count", "text"
    };

    private static readonly HashSet<string> AllowedByteUnitSystems = new(StringComparer.OrdinalIgnoreCase)
    {
        "binary", "decimal"
    };

    public static PluginDefinitionValidationResult Validate(
        string yaml,
        bool requireSchemaVersion = false,
        bool requireVersion = false)
    {
        if (string.IsNullOrWhiteSpace(yaml))
            return Invalid("Request body must contain YAML.");

        var incompatibilityError = PluginSchemaVersionReader.GetIncompatibilityError(yaml);
        if (incompatibilityError is not null)
            return Invalid(incompatibilityError);

        PluginDefinition? definition;
        try
        {
            definition = Deserializer.Deserialize<PluginDefinition>(yaml);
        }
        catch (YamlException ex)
        {
            return Invalid($"Invalid YAML syntax: {ex.Message} (line {ex.Start.Line}, column {ex.Start.Column})");
        }

        if (definition is null)
            return Invalid("YAML could not be deserialized into a plugin definition.");

        var error = ValidateDefinition(definition, requireSchemaVersion, requireVersion);
        return error is null
            ? new PluginDefinitionValidationResult(definition, null)
            : Invalid(error);
    }

    private static PluginDefinitionValidationResult Invalid(string error) => new(null, error);

    private static string? ValidateDefinition(PluginDefinition definition, bool requireSchemaVersion, bool requireVersion)
    {
        if (string.IsNullOrWhiteSpace(definition.PluginId))
            return "Plugin definition is missing required field 'pluginId'.";

        if (!PluginSchema.IsValidPluginId(definition.PluginId))
            return PluginSchema.GetInvalidPluginIdMessage(definition.PluginId);

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

        var versionViolation = PluginSchema.GetVersionViolation(definition, requireSchemaVersion, requireVersion);
        if (versionViolation is not null)
            return versionViolation;

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

        if (definition.Dashboard.Metrics.Any(metric => string.IsNullOrWhiteSpace(metric.Stat)))
            return "Each dashboard metric must define 'stat'.";

        if (definition.Dashboard.Metrics.Any(metric => string.IsNullOrWhiteSpace(metric.Label)))
            return "Each dashboard metric must define 'label'.";

        if (definition.Dashboard.Metrics.Any(metric => string.IsNullOrWhiteSpace(metric.Format)))
            return "Each dashboard metric must define 'format'.";

        if (definition.Dashboard.Metrics.Any(metric => !AllowedStats.Contains(metric.Stat)))
            return "Dashboard metrics contain an unsupported 'stat' value.";

        if (definition.Dashboard.Metrics.Any(metric => !AllowedFormats.Contains(metric.Format)))
            return "Dashboard metrics contain an unsupported 'format' value.";

        if (!string.IsNullOrWhiteSpace(definition.Dashboard.ByteUnitSystem)
            && !AllowedByteUnitSystems.Contains(definition.Dashboard.ByteUnitSystem))
            return "Dashboard config contains an unsupported 'byteUnitSystem' value.";

        return null;
    }
}
