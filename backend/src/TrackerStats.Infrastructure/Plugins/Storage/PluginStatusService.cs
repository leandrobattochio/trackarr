using TrackerStats.Domain.Entities;
using TrackerStats.Domain.Plugins;
using TrackerStats.Domain.Plugins.Yaml;
using TrackerStats.Infrastructure.Plugins.Source;
using TrackerStats.Infrastructure.Plugins.Yaml;

namespace TrackerStats.Infrastructure.Plugins.Storage;

public sealed record PluginStatus(
    string PluginId,
    string DisplayName,
    // Null for an official plugin listed in the index that this trackarr cannot install.
    LoadedYamlPluginDefinition? Loaded,
    PluginOrigin Origin,
    string? Version,
    string? BaseVersion,
    string? LatestOfficialVersion,
    bool Outdated,
    bool Orphan,
    bool Deprecated,
    PluginIncompatibility? Incompatibility,
    bool HiddenOfficial,
    bool LastSyncFailed)
{
    public bool Incompatible => Incompatibility is not null;
}

public sealed record PluginIncompatibility(
    string? Version,
    int RequiredSchemaVersion,
    // The index's optional minAppVersion.
    string? RequiredAppVersion,
    string Message);

public sealed record PluginDiff(
    string PluginId,
    PluginOrigin Origin,
    string? BaseVersion,
    string? LatestOfficialVersion,
    string? Base,
    string? Yours,
    string? LatestOfficial,
    IReadOnlyList<PluginIndexChangelogEntry> Changelog);

public sealed class PluginStatusService(
    IYamlPluginDefinitionLoader loader,
    PluginStorageLayout layout,
    PluginStateStore stateStore)
{
    public IReadOnlyList<PluginStatus> GetStatuses(IEnumerable<Integration> integrations)
    {
        var state = stateStore.Load();
        var allFiles = loader.LoadAllDefinitions();
        var failedPluginIds = integrations
            .Where(integration => integration.LastSyncResult is { } result && result != PluginProcessResult.Success)
            .Select(integration => integration.PluginId)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var statuses = YamlPluginDefinitionLoader.Resolve(allFiles)
            .Select(plugin => GetStatus(plugin, allFiles, state, failedPluginIds.Contains(plugin.PluginId)))
            .ToList();

        var listed = statuses.Select(status => status.PluginId).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var indexed = state.Index?.Plugins ?? new Dictionary<string, IndexedPluginState>();
        foreach (var (pluginId, entry) in indexed.OrderBy(plugin => plugin.Key, StringComparer.Ordinal))
        {
            if (listed.Contains(pluginId) || GetIndexIncompatibility(pluginId, entry) is not { } incompatibility)
                continue;

            statuses.Add(new PluginStatus(
                pluginId, pluginId, null, PluginOrigin.Official, null, null, null,
                Outdated: false, Orphan: false, Deprecated: false, incompatibility,
                HiddenOfficial: false, failedPluginIds.Contains(pluginId)));
        }

        return statuses;
    }

    public PluginDiff? GetDiff(string pluginId)
    {
        var state = stateStore.Load();
        var effective = loader.LoadDefinitions()
            .FirstOrDefault(plugin => string.Equals(plugin.PluginId, pluginId, StringComparison.OrdinalIgnoreCase));
        var latestOfficial = ReadIfExists(layout.GetPluginPath(PluginOrigin.Official, pluginId));
        if (effective is null && latestOfficial is null)
            return null;

        var origin = effective?.Origin ?? PluginOrigin.Official;
        var baseVersion = GetBaseVersion(pluginId, origin, state);
        var latestOfficialVersion = GetLatestOfficialVersion(pluginId, latestOfficial, state);
        return new PluginDiff(
            pluginId,
            origin,
            baseVersion,
            latestOfficialVersion,
            origin == PluginOrigin.Override ? ReadIfExists(layout.GetOverrideBasePath(pluginId)) : null,
            origin == PluginOrigin.Official ? null : effective?.RawContent,
            latestOfficial,
            GetChangelogSinceBase(pluginId, baseVersion, latestOfficialVersion, state));
    }

    private PluginStatus GetStatus(
        LoadedYamlPluginDefinition plugin,
        IReadOnlyList<LoadedYamlPluginDefinition> allFiles,
        PluginState state,
        bool lastSyncFailed)
    {
        var pluginId = plugin.PluginId;
        var header = plugin.Definition is null ? PluginSchemaVersionReader.ReadHeader(plugin.RawContent) : default;
        var version = plugin.Definition?.Version ?? header.Version;

        // An invalid file name has no official, override or index counterpart.
        if (!PluginSchema.IsValidPluginId(pluginId))
            return new PluginStatus(pluginId, plugin.DisplayName, plugin, plugin.Origin, version, null, null,
                Outdated: false, Orphan: false, Deprecated: false, null, HiddenOfficial: false, lastSyncFailed);

        var officialFile = allFiles.FirstOrDefault(file =>
            file.Origin == PluginOrigin.Official && string.Equals(file.PluginId, pluginId, StringComparison.OrdinalIgnoreCase));
        var latestOfficialVersion = officialFile is null
            ? null
            : GetLatestOfficialVersion(pluginId, officialFile.RawContent, state);
        var baseVersion = GetBaseVersion(pluginId, plugin.Origin, state);
        var indexEntry = state.Index?.Plugins.GetValueOrDefault(pluginId);
        var removedFromIndex = state.Index is not null && indexEntry is null;

        PluginIncompatibility? incompatibility = null;
        if (plugin.Incompatible && header.SchemaVersion is { } fileSchemaVersion)
            incompatibility = new PluginIncompatibility(
                version, fileSchemaVersion, null, PluginSchema.GetIncompatibleMessage(fileSchemaVersion));
        else if (plugin.Origin != PluginOrigin.Custom && indexEntry is not null)
            incompatibility = GetIndexIncompatibility(pluginId, indexEntry);

        var hiddenOfficial = plugin.Origin == PluginOrigin.Custom
                             && (allFiles.Any(file => file.Origin != PluginOrigin.Custom
                                                      && string.Equals(file.PluginId, pluginId, StringComparison.OrdinalIgnoreCase))
                                 || state.Official.ContainsKey(pluginId)
                                 || indexEntry is not null);

        return new PluginStatus(
            pluginId,
            plugin.DisplayName,
            plugin,
            plugin.Origin,
            version,
            baseVersion,
            latestOfficialVersion,
            Outdated: plugin.Origin == PluginOrigin.Override && IsNewer(latestOfficialVersion, baseVersion),
            Orphan: plugin.Origin == PluginOrigin.Override && removedFromIndex,
            Deprecated: plugin.Origin == PluginOrigin.Official && removedFromIndex,
            incompatibility,
            hiddenOfficial,
            lastSyncFailed);
    }

    private static PluginIncompatibility? GetIndexIncompatibility(string pluginId, IndexedPluginState entry) =>
        PluginSchema.GetCompatibility(entry.SchemaVersion) == PluginSchemaCompatibility.Incompatible
            ? new PluginIncompatibility(
                entry.Version,
                entry.SchemaVersion,
                entry.MinAppVersion,
                PluginSchema.GetUpdateRequiredMessage(pluginId, entry.Version, entry.SchemaVersion))
            : null;

    private static string? GetBaseVersion(string pluginId, PluginOrigin origin, PluginState state) =>
        origin == PluginOrigin.Override ? state.Overrides.GetValueOrDefault(pluginId)?.BaseVersion : null;

    // An incompatible newer version never lands on disk, so the installed file is the latest usable one.
    private static string? GetLatestOfficialVersion(string pluginId, string? officialContent, PluginState state) =>
        officialContent is null
            ? null
            : state.Official.GetValueOrDefault(pluginId)?.Version ?? PluginSchemaVersionReader.ReadHeader(officialContent).Version;

    private static IReadOnlyList<PluginIndexChangelogEntry> GetChangelogSinceBase(
        string pluginId,
        string? baseVersion,
        string? latestOfficialVersion,
        PluginState state)
    {
        var entry = state.Index?.Plugins.GetValueOrDefault(pluginId);
        if (entry is null || !IsNewer(latestOfficialVersion, baseVersion))
            return [];

        return entry.Changelog
            .Where(item => IsNewer(item.Version, baseVersion) && !IsNewer(item.Version, latestOfficialVersion))
            .ToList();
    }

    private static bool IsNewer(string? version, string? than) =>
        version is not null && than is not null
        && PluginSchema.IsSemanticVersion(version) && PluginSchema.IsSemanticVersion(than)
        && PluginSchema.CompareVersions(version, than) > 0;

    private static string? ReadIfExists(string path)
    {
        try
        {
            return File.ReadAllText(path);
        }
        catch (Exception ex) when (ex is FileNotFoundException or DirectoryNotFoundException)
        {
            return null;
        }
    }
}
