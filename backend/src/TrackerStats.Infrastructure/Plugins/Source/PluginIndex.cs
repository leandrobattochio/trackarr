namespace TrackerStats.Infrastructure.Plugins.Source;

public sealed record PluginIndexChangelogEntry(string Version, string Date, string Notes);

public sealed record PluginIndexEntry(
    string Id,
    string Version,
    int SchemaVersion,
    string Path,
    string Sha256,
    IReadOnlyList<PluginIndexChangelogEntry> Changelog,
    // Optional: the first trackarr version that supports SchemaVersion.
    string? MinAppVersion = null);

public sealed record PluginIndex(IReadOnlyList<PluginIndexEntry> Plugins);

public enum PluginFileFetchStatus
{
    Unchanged,
    Downloaded,
    Failed
}

public sealed record PluginFileFetchResult(
    PluginIndexEntry Entry,
    PluginFileFetchStatus Status,
    byte[]? Content = null,
    string? Error = null);

public sealed record PluginIndexFetchResult(
    string Source,
    string? IndexSha256,
    PluginIndex? Index,
    IReadOnlyList<PluginFileFetchResult> Files,
    string? Error)
{
    public bool Succeeded => Error is null;

    public static PluginIndexFetchResult Failure(string source, string error, string? indexSha256 = null) =>
        new(source, indexSha256, null, [], error);
}
