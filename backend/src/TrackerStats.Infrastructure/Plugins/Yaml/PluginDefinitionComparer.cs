using System.Text.Json;
using System.Text.Json.Nodes;
using TrackerStats.Domain.Plugins.Yaml;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace TrackerStats.Infrastructure.Plugins.Yaml;

public static class PluginDefinitionComparer
{
    private static readonly IDeserializer Deserializer = new DeserializerBuilder()
        .WithNamingConvention(CamelCaseNamingConvention.Instance)
        .Build();

    // Compared after engine defaults, so an explicit default value is not a change.
    public static bool AreSemanticallyEqual(string left, string right)
    {
        var leftJson = ToCanonicalJson(left);
        return leftJson is not null && leftJson == ToCanonicalJson(right);
    }

    private static string? ToCanonicalJson(string yaml)
    {
        try
        {
            var definition = Deserializer.Deserialize<PluginDefinition>(yaml);
            if (definition is null)
                return null;

            definition.Fields ??= [];
            definition.CustomFields ??= [];
            PluginDefinitionDefaults.ApplyDefaults(definition, userAgent: "");
            return Canonicalize(JsonSerializer.SerializeToNode(definition))?.ToJsonString();
        }
        catch (Exception)
        {
            return null;
        }
    }

    private static JsonNode? Canonicalize(JsonNode? node) => node switch
    {
        JsonObject obj => new JsonObject(obj
            .OrderBy(property => property.Key, StringComparer.Ordinal)
            .Select(property => KeyValuePair.Create(property.Key, Canonicalize(property.Value)))),
        JsonArray array => new JsonArray(array.Select(Canonicalize).ToArray()),
        _ => node?.DeepClone()
    };
}
