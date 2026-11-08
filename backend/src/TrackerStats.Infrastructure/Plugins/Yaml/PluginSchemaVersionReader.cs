using TrackerStats.Domain.Plugins.Yaml;
using YamlDotNet.Core;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace TrackerStats.Infrastructure.Plugins.Yaml;

public static class PluginSchemaVersionReader
{
    // Lenient on purpose: a plugin written for a newer format may not fit PluginDefinition.
    private static readonly IDeserializer HeaderDeserializer = new DeserializerBuilder()
        .WithNamingConvention(CamelCaseNamingConvention.Instance)
        .IgnoreUnmatchedProperties()
        .Build();

    public static string? GetIncompatibilityError(string content)
    {
        var schemaVersion = TryRead<SchemaHeader>(content)?.SchemaVersion;
        return PluginSchema.GetCompatibility(schemaVersion) == PluginSchemaCompatibility.Incompatible
            ? PluginSchema.GetIncompatibleMessage(schemaVersion!.Value)
            : null;
    }

    public static (int? SchemaVersion, string? Version) ReadHeader(string content) =>
        (TryRead<SchemaHeader>(content)?.SchemaVersion, TryRead<VersionHeader>(content)?.Version);

    // One key per type, so a malformed key does not hide the other one.
    private static T? TryRead<T>(string content) where T : class
    {
        try
        {
            return HeaderDeserializer.Deserialize<T>(content);
        }
        catch (YamlException)
        {
            return null;
        }
    }

    private sealed class SchemaHeader
    {
        public int? SchemaVersion { get; set; }
    }

    private sealed class VersionHeader
    {
        public string? Version { get; set; }
    }
}
