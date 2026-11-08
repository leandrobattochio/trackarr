using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using TrackerStats.Domain.Plugins.Yaml;

namespace TrackerStats.Infrastructure.Plugins.Source;

public static partial class PluginIndexParser
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        NumberHandling = JsonNumberHandling.Strict
    };

    public static PluginIndex Parse(ReadOnlySpan<byte> json)
    {
        IndexDocument? document;
        try
        {
            document = JsonSerializer.Deserialize<IndexDocument>(json, JsonOptions);
        }
        catch (JsonException ex)
        {
            throw new FormatException($"index.json is not valid JSON: {ex.Message}", ex);
        }

        if (document?.Plugins is null)
            throw new FormatException("index.json has no 'plugins' array.");
        if (document.Plugins.Count == 0)
            throw new FormatException("index.json lists no plugins.");

        var ids = new HashSet<string>(StringComparer.Ordinal);
        var entries = new List<PluginIndexEntry>(document.Plugins.Count);
        for (var position = 0; position < document.Plugins.Count; position++)
        {
            var entry = ParseEntry(document.Plugins[position], position);
            if (!ids.Add(entry.Id))
                throw new FormatException($"index.json lists plugin '{entry.Id}' more than once.");
            entries.Add(entry);
        }

        return new PluginIndex(entries);
    }

    private static PluginIndexEntry ParseEntry(IndexEntryDocument? entry, int position)
    {
        if (entry is null)
            throw new FormatException($"index.json plugins[{position}] is null.");

        var label = $"index.json plugins[{position}]";
        if (string.IsNullOrEmpty(entry.Id) || !PluginSchema.IsValidPluginId(entry.Id))
            throw new FormatException($"{label} has an invalid id '{entry.Id}'.");
        label = $"index.json plugin '{entry.Id}'";
        if (string.IsNullOrEmpty(entry.Version) || !PluginSchema.IsSemanticVersion(entry.Version))
            throw new FormatException($"{label} has an invalid version '{entry.Version}'.");
        if (entry.SchemaVersion is not >= 1)
            throw new FormatException($"{label} has an invalid schemaVersion.");
        if (string.IsNullOrEmpty(entry.Path) || !RelativeYamlPathRegex().IsMatch(entry.Path))
            throw new FormatException($"{label} has an invalid path '{entry.Path}'.");
        if (string.IsNullOrEmpty(entry.Sha256) || !Sha256Regex().IsMatch(entry.Sha256))
            throw new FormatException($"{label} has an invalid sha256.");
        if (entry.MinAppVersion is not null && !PluginSchema.IsSemanticVersion(entry.MinAppVersion))
            throw new FormatException($"{label} has an invalid minAppVersion '{entry.MinAppVersion}'.");

        var changelog = (entry.Changelog ?? []).Select(item =>
            item is { Version: not null, Date: not null, Notes: not null }
                ? new PluginIndexChangelogEntry(item.Version, item.Date, item.Notes)
                : throw new FormatException($"{label} has a changelog entry without version, date or notes."))
            .ToList();

        return new PluginIndexEntry(entry.Id, entry.Version, entry.SchemaVersion.Value, entry.Path, entry.Sha256, changelog, entry.MinAppVersion);
    }

    // Relative, forward slashes, no segment starting with '.', so '..' and absolute paths cannot escape the source.
    [GeneratedRegex(@"^[A-Za-z0-9_-][A-Za-z0-9._-]*(/[A-Za-z0-9_-][A-Za-z0-9._-]*)*\.yaml\z")]
    private static partial Regex RelativeYamlPathRegex();

    [GeneratedRegex(@"^[0-9a-f]{64}\z")]
    private static partial Regex Sha256Regex();

    private sealed record IndexDocument(List<IndexEntryDocument?>? Plugins);

    private sealed record IndexEntryDocument(
        string? Id,
        string? Version,
        int? SchemaVersion,
        string? Path,
        string? Sha256,
        List<IndexChangelogDocument>? Changelog,
        string? MinAppVersion);

    private sealed record IndexChangelogDocument(string? Version, string? Date, string? Notes);
}
