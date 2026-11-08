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

    // Compared after resolving 'extends' and applying engine defaults, so an inherited or default value written out is not a change.
    public static bool AreSemanticallyEqual(string left, string right, IPluginBaseLookup? bases = null)
    {
        var leftJson = ToCanonicalJson(left, bases);
        return leftJson is not null && leftJson == ToCanonicalJson(right, bases);
    }

    private static string? ToCanonicalJson(string yaml, IPluginBaseLookup? bases)
    {
        try
        {
            var definition = Deserializer.Deserialize<PluginDefinition>(PluginBaseResolver.Resolve(yaml, bases).Yaml);
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
