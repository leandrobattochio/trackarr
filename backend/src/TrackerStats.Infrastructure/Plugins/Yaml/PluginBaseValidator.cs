using TrackerStats.Domain.Plugins.Yaml;
using YamlDotNet.Core;
using YamlDotNet.RepresentationModel;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace TrackerStats.Infrastructure.Plugins.Yaml;

public sealed record PluginBaseParseResult(
    string? BaseId,
    string? DisplayName,
    string? Version,
    int? SchemaVersion,
    IReadOnlyList<PluginChangelogEntry> Changelog,
    YamlMappingNode? Root,
    string? Error)
{
    public bool IsValid => Error is null;

    public static PluginBaseParseResult Invalid(string error) => new(null, null, null, null, [], null, error);
}

public static class PluginBaseValidator
{
    public static readonly IReadOnlyList<string> InheritableKeys =
        ["fields", "customFields", "http", "authFailure", "steps", "mapping", "dashboard"];

    private static readonly IReadOnlyList<string> HeaderKeys =
        ["baseId", "displayName", "version", "schemaVersion", "changelog"];

    private static readonly IDeserializer HeaderDeserializer = new DeserializerBuilder()
        .WithNamingConvention(CamelCaseNamingConvention.Instance)
        .IgnoreUnmatchedProperties()
        .Build();

    /// <summary>Checks the header and the key set; the content is checked by <see cref="Validate"/>.</summary>
    public static PluginBaseParseResult Parse(string yaml)
    {
        var root = PluginBaseResolver.TryLoadMapping(yaml, out _);
        if (root is null)
            return PluginBaseParseResult.Invalid("A plugin base must be one YAML mapping.");

        foreach (var key in root.Children.Keys)
        {
            var name = (key as YamlScalarNode)?.Value;
            if (name is null || (!HeaderKeys.Contains(name) && !InheritableKeys.Contains(name)))
                return PluginBaseParseResult.Invalid(
                    $"Property '{name}' is not allowed in a plugin base. Allowed: {string.Join(", ", HeaderKeys.Concat(InheritableKeys))}.");
        }

        BaseHeader header;
        try
        {
            header = HeaderDeserializer.Deserialize<BaseHeader>(yaml) ?? new BaseHeader();
        }
        catch (YamlException ex)
        {
            return PluginBaseParseResult.Invalid($"The base header is invalid: {ex.Message}");
        }

        if (string.IsNullOrWhiteSpace(header.BaseId) || !PluginSchema.IsValidPluginId(header.BaseId))
            return PluginBaseParseResult.Invalid(
                $"Property 'baseId' is required and must match {PluginSchema.PluginIdPattern}.");
        if (string.IsNullOrWhiteSpace(header.Version) || !PluginSchema.IsSemanticVersion(header.Version))
            return PluginBaseParseResult.Invalid("Property 'version' is required and must be a semantic version such as 1.2.0.");

        switch (PluginSchema.GetCompatibility(header.SchemaVersion))
        {
            case PluginSchemaCompatibility.Missing or PluginSchemaCompatibility.Invalid:
                return PluginBaseParseResult.Invalid("Property 'schemaVersion' is required and must be a positive integer.");
            case PluginSchemaCompatibility.Incompatible:
                return PluginBaseParseResult.Invalid(PluginSchema.GetIncompatibleMessage(header.SchemaVersion!.Value));
        }

        if (header.SchemaVersion < PluginSchema.ExtendsSchemaVersion)
            return PluginBaseParseResult.Invalid($"A plugin base needs 'schemaVersion: {PluginSchema.ExtendsSchemaVersion}' or later.");

        var changelog = header.Changelog ?? [];
        if (changelog.Any(entry => entry is null
                                   || string.IsNullOrWhiteSpace(entry.Version)
                                   || string.IsNullOrWhiteSpace(entry.Date)
                                   || string.IsNullOrWhiteSpace(entry.Notes)))
            return PluginBaseParseResult.Invalid("Each changelog entry must have 'version', 'date' and 'notes'.");

        return new PluginBaseParseResult(
            header.BaseId,
            string.IsNullOrWhiteSpace(header.DisplayName) ? header.BaseId : header.DisplayName,
            header.Version,
            header.SchemaVersion,
            changelog.OfType<PluginChangelogEntry>().ToList(),
            root,
            null);
    }

    /// <summary>Also checks that the base is complete: a plugin that only sets its header and extends it must be valid.</summary>
    public static PluginBaseParseResult Validate(string yaml)
    {
        var parsed = Parse(yaml);
        if (!parsed.IsValid)
            return parsed;

        var probe = $"""
            pluginId: {parsed.BaseId}
            displayName: {parsed.BaseId}
            version: 1.0.0
            schemaVersion: {parsed.SchemaVersion}
            extends: {parsed.BaseId}
            baseUrls:
              - https://tracker.example/
            """;
        var validation = PluginDefinitionValidator.Validate(probe, bases: new SingleBaseLookup(parsed.BaseId!, yaml));
        return validation.IsValid
            ? parsed
            : parsed with { Error = $"A plugin that extends it is invalid: {validation.Error}" };
    }

    private sealed class SingleBaseLookup(string baseId, string content) : IPluginBaseLookup
    {
        public string? GetBaseContent(string id) => id == baseId ? content : null;
    }

    private sealed class BaseHeader
    {
        public string? BaseId { get; set; }
        public string? DisplayName { get; set; }
        public string? Version { get; set; }
        public int? SchemaVersion { get; set; }
        public List<PluginChangelogEntry?>? Changelog { get; set; }
    }
}
