using System.Text;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using TrackerStats.Domain.Plugins.Yaml;
using TrackerStats.Domain.Repositories;
using TrackerStats.Infrastructure.Plugins.Storage;
using TrackerStats.Infrastructure.Plugins.Yaml;

namespace TrackerStats.Infrastructure.Plugins.Source;

public sealed class PluginDownloadService(
    PluginIndexClient indexClient,
    PluginStorageLayout layout,
    PluginStateStore stateStore,
    PluginOverrideService overrides,
    IServiceScopeFactory scopeFactory,
    ILogger<PluginDownloadService> logger)
{
    public const int MaxUpdateRecords = 200;

    public async Task<PluginDownloadReport> RunAsync(CancellationToken cancellationToken = default)
    {
        var startedAt = DateTimeOffset.UtcNow;
        var state = stateStore.Load();
        var installed = state.Official
            .Where(plugin => File.Exists(layout.GetPluginPath(PluginOrigin.Official, plugin.Key)))
            .ToDictionary(plugin => plugin.Key, plugin => plugin.Value, StringComparer.Ordinal);

        var fetch = await indexClient.FetchAsync(installed, cancellationToken);
        if (!fetch.Succeeded)
        {
            var failed = new PluginDownloadReport(startedAt, DateTimeOffset.UtcNow, fetch.Source, fetch.IndexSha256, fetch.Error, []);
            stateStore.Update(current => current.LastDownload = failed);
            return failed;
        }

        var run = new Run(state);
        var results = fetch.Files.Select(file => Apply(file, run)).ToList();

        var indexIds = fetch.Index!.Plugins.Select(entry => entry.Id).ToHashSet(StringComparer.Ordinal);
        foreach (var pluginId in GetInstalledIds(state).Where(id => !indexIds.Contains(id)).Order(StringComparer.Ordinal))
            results.Add(await HandleRemovedAsync(pluginId, run, cancellationToken));

        var completedAt = DateTimeOffset.UtcNow;
        var report = new PluginDownloadReport(startedAt, completedAt, fetch.Source, fetch.IndexSha256, null, results);
        stateStore.Update(current =>
        {
            foreach (var (pluginId, official) in run.OfficialChanges)
            {
                if (official is null)
                    current.Official.Remove(pluginId);
                else
                    current.Official[pluginId] = official;
            }

            current.Index = new PluginIndexState(
                fetch.Source,
                fetch.IndexSha256!,
                completedAt,
                fetch.Index.Plugins.ToDictionary(
                    entry => entry.Id,
                    entry => new IndexedPluginState(entry.Version, entry.SchemaVersion, entry.Sha256, entry.Changelog, entry.MinAppVersion),
                    StringComparer.Ordinal));

            foreach (var update in run.Updates)
                current.Updates.Add(update with { Id = ++current.LastUpdateId, AppliedAt = completedAt });
            if (current.Updates.Count > MaxUpdateRecords)
                current.Updates.RemoveRange(0, current.Updates.Count - MaxUpdateRecords);

            current.LastDownload = report;
        });
        overrides.RestoreMissingBaseCopies();

        logger.LogInformation(
            "Plugin download from {Source} finished: {Outcomes}",
            fetch.Source,
            string.Join(", ", results.Select(result => $"{result.PluginId} {result.Outcome}")));
        return report;
    }

    private PluginDownloadPluginResult Apply(PluginFileFetchResult file, Run run)
    {
        var entry = file.Entry;
        var officialPath = layout.GetPluginPath(PluginOrigin.Official, entry.Id);
        var overridden = File.Exists(layout.GetPluginPath(PluginOrigin.Override, entry.Id));
        var hiddenByCustom = !overridden && File.Exists(layout.GetPluginPath(PluginOrigin.Custom, entry.Id));
        run.State.Official.TryGetValue(entry.Id, out var recorded);
        var installedVersion = File.Exists(officialPath) ? recorded?.Version : null;

        PluginDownloadPluginResult Result(PluginDownloadOutcome outcome, string? message = null, string? officialVersion = null) =>
            new(entry.Id, entry.Version, outcome, overridden,
                IsOutdated(entry.Id, officialVersion ?? installedVersion, run.State), hiddenByCustom, message);

        if (PluginSchema.GetCompatibility(entry.SchemaVersion) == PluginSchemaCompatibility.Incompatible)
            return Result(PluginDownloadOutcome.Incompatible, PluginSchema.GetUpdateRequiredMessage(entry.Id, entry.Version, entry.SchemaVersion));

        switch (file.Status)
        {
            case PluginFileFetchStatus.Failed:
                return Result(PluginDownloadOutcome.Failed, file.Error);
            case PluginFileFetchStatus.Unchanged:
                return Result(PluginDownloadOutcome.Unchanged);
        }

        var contentError = GetContentError(entry, file.Content!);
        if (contentError is not null)
        {
            logger.LogWarning("Plugin {PluginId} {Version} rejected: {Error}", entry.Id, entry.Version, contentError);
            return Result(PluginDownloadOutcome.Failed, $"Rejected {entry.Path}: {contentError}");
        }

        var existed = File.Exists(officialPath);
        if (existed && recorded is not null && PluginStateStore.ComputeFileSha256(officialPath) != recorded.Sha256)
        {
            return Result(
                PluginDownloadOutcome.LocallyModified,
                $"official/{entry.Id}.yaml was changed on disk, so version {entry.Version} was not written over it.");
        }

        try
        {
            WriteOfficial(entry.Id, officialPath, file.Content!);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            logger.LogWarning(ex, "Could not write {Path}", officialPath);
            return Result(PluginDownloadOutcome.Failed, $"Could not write official/{entry.Id}.yaml: {ex.Message}");
        }

        run.OfficialChanges[entry.Id] = new OfficialPluginState(entry.Version, entry.Sha256);
        if (!overridden && !hiddenByCustom && run.State.Index is not null && installedVersion != entry.Version)
        {
            run.Updates.Add(new PluginUpdateRecord(
                0, entry.Id, installedVersion, entry.Version, default, GetChangelogBetween(entry, installedVersion)));
        }

        return Result(existed ? PluginDownloadOutcome.Updated : PluginDownloadOutcome.Installed, officialVersion: entry.Version);
    }

    private async Task<PluginDownloadPluginResult> HandleRemovedAsync(string pluginId, Run run, CancellationToken cancellationToken)
    {
        var officialPath = layout.GetPluginPath(PluginOrigin.Official, pluginId);
        run.State.Official.TryGetValue(pluginId, out var recorded);
        var version = recorded?.Version;

        if (File.Exists(layout.GetPluginPath(PluginOrigin.Override, pluginId)))
            return new(pluginId, version, PluginDownloadOutcome.Orphan, Overridden: true,
                Message: "Removed from the plugin index. Your override keeps working.");

        if (!File.Exists(officialPath))
        {
            run.OfficialChanges[pluginId] = null;
            return new(pluginId, version, PluginDownloadOutcome.Removed, Message: "Removed from the plugin index.");
        }

        if (recorded is not null && PluginStateStore.ComputeFileSha256(officialPath) != recorded.Sha256)
            return new(pluginId, version, PluginDownloadOutcome.LocallyModified,
                Message: $"Removed from the plugin index, but official/{pluginId}.yaml was changed on disk, so it was kept.");

        var hiddenByCustom = File.Exists(layout.GetPluginPath(PluginOrigin.Custom, pluginId));
        if (!hiddenByCustom && await IsUsedByIntegrationAsync(pluginId, cancellationToken))
            return new(pluginId, version, PluginDownloadOutcome.Deprecated,
                Message: "Removed from the plugin index. The cached copy keeps working for the integrations that use it.");

        try
        {
            File.Delete(officialPath);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            logger.LogWarning(ex, "Could not delete {Path}", officialPath);
            return new(pluginId, version, PluginDownloadOutcome.Failed, HiddenByCustom: hiddenByCustom,
                Message: $"Removed from the plugin index, but official/{pluginId}.yaml could not be deleted: {ex.Message}");
        }

        run.OfficialChanges[pluginId] = null;
        return new(pluginId, version, PluginDownloadOutcome.Removed, HiddenByCustom: hiddenByCustom,
            Message: "Removed from the plugin index and not used by any integration, so it was deleted.");
    }

    private IEnumerable<string> GetInstalledIds(PluginState state)
    {
        var files = Directory.Exists(layout.OfficialDirectory)
            ? Directory.EnumerateFiles(layout.OfficialDirectory, "*.yaml")
                .Select(Path.GetFileNameWithoutExtension)
                .OfType<string>()
                .Where(PluginSchema.IsValidPluginId)
            : [];
        return state.Official.Keys.Union(files, StringComparer.Ordinal);
    }

    private async Task<bool> IsUsedByIntegrationAsync(string pluginId, CancellationToken cancellationToken)
    {
        try
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            return await scope.ServiceProvider.GetRequiredService<IIntegrationRepository>()
                .ExistsByPluginIdAsync(pluginId, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Keeping a removed plugin is harmless; deleting one an integration still needs is not.
            logger.LogWarning(ex, "Could not check whether plugin {PluginId} is in use; keeping it", pluginId);
            return true;
        }
    }

    private void WriteOfficial(string pluginId, string officialPath, byte[] content)
    {
        Directory.CreateDirectory(layout.OfficialDirectory);
        var temporaryPath = Path.Combine(layout.OfficialDirectory, $".{pluginId}.download");
        File.WriteAllBytes(temporaryPath, content);
        File.Move(temporaryPath, officialPath, overwrite: true);
    }

    private static string? GetContentError(PluginIndexEntry entry, byte[] content)
    {
        var validation = PluginDefinitionValidator.Validate(
            Encoding.UTF8.GetString(content), requireSchemaVersion: true, requireVersion: true);
        if (!validation.IsValid)
            return validation.Error;

        var definition = validation.Definition!;
        if (definition.PluginId != entry.Id)
            return $"the file declares pluginId '{definition.PluginId}', but the index lists '{entry.Id}'.";
        if (definition.Version != entry.Version || definition.SchemaVersion != entry.SchemaVersion)
            return $"the file declares version {definition.Version} (schema {definition.SchemaVersion}), but the index lists {entry.Version} (schema {entry.SchemaVersion}).";
        return null;
    }

    private static bool IsOutdated(string pluginId, string? officialVersion, PluginState state) =>
        officialVersion is not null
        && state.Overrides.TryGetValue(pluginId, out var overrideState)
        && PluginSchema.IsSemanticVersion(officialVersion)
        && PluginSchema.IsSemanticVersion(overrideState.BaseVersion)
        && PluginSchema.CompareVersions(officialVersion, overrideState.BaseVersion) > 0;

    private static IReadOnlyList<PluginIndexChangelogEntry> GetChangelogBetween(PluginIndexEntry entry, string? fromVersion)
    {
        var hasFrom = fromVersion is not null && PluginSchema.IsSemanticVersion(fromVersion);
        return entry.Changelog.Where(item =>
            PluginSchema.IsSemanticVersion(item.Version)
            && PluginSchema.CompareVersions(item.Version, entry.Version) <= 0
            && (!hasFrom || PluginSchema.CompareVersions(item.Version, fromVersion!) > 0)).ToList();
    }

    private sealed class Run(PluginState state)
    {
        public PluginState State { get; } = state;
        public Dictionary<string, OfficialPluginState?> OfficialChanges { get; } = new(StringComparer.Ordinal);
        public List<PluginUpdateRecord> Updates { get; } = [];
    }
}
