using System.Collections.Concurrent;
using TrackerStats.Domain.Plugins.Yaml;
using YamlDotNet.Core;
using YamlDotNet.RepresentationModel;

namespace TrackerStats.Infrastructure.Plugins.Yaml;

public sealed record PluginBaseResolution(string Yaml, string? Error)
{
    public bool Succeeded => Error is null;
}

public static class PluginBaseResolver
{
    public const string ExtendsKey = "extends";

    // The registry reloads every plugin on each lookup, so each base would otherwise be parsed once per plugin.
    private static readonly ConcurrentDictionary<string, PluginBaseParseResult> ParsedBases = new(StringComparer.Ordinal);

    public static PluginBaseResolution Resolve(string yaml, IPluginBaseLookup? bases)
    {
        var root = TryLoadMapping(yaml, out var stream);
        if (root is null)
            return new PluginBaseResolution(yaml, null);

        if (!root.Children.TryGetValue(new YamlScalarNode(ExtendsKey), out var extendsNode))
            return new PluginBaseResolution(yaml, null);

        if (extendsNode is not YamlScalarNode { Value: { } baseId } || !PluginSchema.IsValidPluginId(baseId))
            return new PluginBaseResolution(yaml, $"Property '{ExtendsKey}' must be the id of a plugin base, such as 'unit3d'.");

        var baseContent = bases?.GetBaseContent(baseId);
        if (baseContent is null)
            return new PluginBaseResolution(yaml, $"The plugin extends base '{baseId}', which is not installed.");

        if (ParsedBases.Count > 64)
            ParsedBases.Clear();
        var parsedBase = ParsedBases.GetOrAdd(baseContent, PluginBaseValidator.Parse);
        if (parsedBase.Error is not null)
            return new PluginBaseResolution(yaml, $"Plugin base '{baseId}' is invalid. {parsedBase.Error}");
        if (parsedBase.BaseId != baseId)
            return new PluginBaseResolution(yaml, $"Plugin base file '{baseId}' declares baseId '{parsedBase.BaseId}'.");

        foreach (var key in PluginBaseValidator.InheritableKeys)
        {
            var keyNode = new YamlScalarNode(key);
            if (!root.Children.ContainsKey(keyNode) && parsedBase.Root!.Children.TryGetValue(keyNode, out var value))
                root.Add(keyNode, value);
        }

        using var writer = new StringWriter();
        stream!.Save(writer, assignAnchors: false);
        return new PluginBaseResolution(writer.ToString(), null);
    }

    public static string? ReadExtends(string yaml) =>
        TryLoadMapping(yaml, out _) is { } root
        && root.Children.TryGetValue(new YamlScalarNode(ExtendsKey), out var node)
        && node is YamlScalarNode { Value: { } value }
            ? value
            : null;

    // Invalid YAML is left to the plugin validator, which reports the syntax error with its position.
    internal static YamlMappingNode? TryLoadMapping(string yaml, out YamlStream? stream)
    {
        stream = new YamlStream();
        try
        {
            stream.Load(new StringReader(yaml));
        }
        catch (YamlException)
        {
            stream = null;
            return null;
        }

        return stream.Documents.Count == 1 ? stream.Documents[0].RootNode as YamlMappingNode : null;
    }
}
