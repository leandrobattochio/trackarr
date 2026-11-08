using TrackerStats.Infrastructure.Plugins.Source;

namespace TrackerStats.Infrastructure.Plugins.Storage;

public sealed record IndexedPluginState(
    string Version,
    int SchemaVersion,
    string Sha256,
    IReadOnlyList<PluginIndexChangelogEntry> Changelog,
    string? MinAppVersion = null);

public sealed record PluginIndexState(
    string Source,
    string Sha256,
    DateTimeOffset FetchedAt,
    Dictionary<string, IndexedPluginState> Plugins,
    Dictionary<string, IndexedPluginState>? Bases = null);

public enum PluginDownloadOutcome
{
    Installed,
    Updated,
    Unchanged,
    Failed,
    Incompatible,
    LocallyModified,
    Orphan,
    Deprecated,
    Removed
}

public sealed record PluginDownloadPluginResult(
    string PluginId,
    string? Version,
    PluginDownloadOutcome Outcome,
    bool Overridden = false,
    bool Outdated = false,
    bool HiddenByCustom = false,
    string? Message = null);

public sealed record PluginDownloadReport(
    DateTimeOffset StartedAt,
    DateTimeOffset CompletedAt,
    string Source,
    string? IndexSha256,
    string? Error,
    IReadOnlyList<PluginDownloadPluginResult> Plugins,
    IReadOnlyList<PluginDownloadPluginResult>? Bases = null)
{
    public bool Succeeded => Error is null;
}

public sealed record PluginUpdateRecord(
    long Id,
    string PluginId,
    string? FromVersion,
    string ToVersion,
    DateTimeOffset AppliedAt,
    IReadOnlyList<PluginIndexChangelogEntry> Changelog,
    // Set when the update is to a plugin base; PluginId is then the base id.
    bool IsBase = false,
    string? DisplayName = null);
