using System.Text;
using Microsoft.Extensions.Logging;
using TrackerStats.Domain.Plugins.Yaml;
using TrackerStats.Infrastructure.Plugins.Yaml;

namespace TrackerStats.Infrastructure.Plugins.Storage;

public enum PluginOverrideSaveOutcome
{
    Saved,
    Discarded,
    MatchesOfficial
}

public sealed class PluginOverrideService(
    PluginStorageLayout layout,
    PluginStateStore stateStore,
    PluginBaseStore bases,
    ILogger<PluginOverrideService> logger)
{
    private readonly Lock _gate = new();

    public PluginOverrideSaveOutcome SaveOfficialEdit(string pluginId, string yaml)
    {
        lock (_gate)
        {
            AdoptIfLocallyModified(pluginId);

            var overridePath = layout.GetPluginPath(PluginOrigin.Override, pluginId);
            var officialPath = layout.GetPluginPath(PluginOrigin.Official, pluginId);
            var state = stateStore.Load();
            var overrideExists = File.Exists(overridePath);

            OverridePluginState? baseState;
            string? baseContent;
            if (overrideExists)
            {
                baseState = state.Overrides.GetValueOrDefault(pluginId);
                baseContent = ReadBaseContent(pluginId, baseState);
            }
            else
            {
                if (!File.Exists(officialPath))
                    throw new InvalidOperationException($"Plugin '{pluginId}' has no official file to override.");

                var officialBytes = File.ReadAllBytes(officialPath);
                baseContent = Encoding.UTF8.GetString(officialBytes);
                baseState = new OverridePluginState(
                    state.Official.GetValueOrDefault(pluginId)?.Version ?? ReadVersion(baseContent),
                    PluginStateStore.ComputeSha256(officialBytes));
            }

            if (File.Exists(officialPath) && MatchesBase(yaml, baseContent, baseState))
            {
                if (!overrideExists)
                    return PluginOverrideSaveOutcome.MatchesOfficial;

                Remove(pluginId);
                logger.LogInformation("Override of plugin {PluginId} matches its base again and was discarded", pluginId);
                return PluginOverrideSaveOutcome.Discarded;
            }

            Directory.CreateDirectory(layout.OverridesDirectory);
            if (!overrideExists)
            {
                File.Copy(officialPath, layout.GetOverrideBasePath(pluginId), overwrite: true);
                stateStore.Update(current => current.Overrides[pluginId] = baseState!);
            }

            WriteAtomically(overridePath, yaml);
            return PluginOverrideSaveOutcome.Saved;
        }
    }

    public bool DeleteOverride(string pluginId)
    {
        lock (_gate)
        {
            var existed = File.Exists(layout.GetPluginPath(PluginOrigin.Override, pluginId));
            Remove(pluginId);
            return existed;
        }
    }

    public IReadOnlyList<string> AdoptLocallyModifiedOfficials()
    {
        lock (_gate)
        {
            return stateStore.Load().Official.Keys
                .Where(PluginSchema.IsValidPluginId)
                .Order(StringComparer.Ordinal)
                .Where(AdoptIfLocallyModified)
                .ToList();
        }
    }

    // An adopted override has no base copy until the download restores the original official file.
    public void RestoreMissingBaseCopies()
    {
        lock (_gate)
        {
            foreach (var (pluginId, baseState) in stateStore.Load().Overrides)
            {
                if (!PluginSchema.IsValidPluginId(pluginId))
                    continue;

                var basePath = layout.GetOverrideBasePath(pluginId);
                var officialPath = layout.GetPluginPath(PluginOrigin.Official, pluginId);
                if (File.Exists(basePath)
                    || !File.Exists(layout.GetPluginPath(PluginOrigin.Override, pluginId))
                    || !File.Exists(officialPath)
                    || PluginStateStore.ComputeFileSha256(officialPath) != baseState.BaseSha256)
                    continue;

                try
                {
                    File.Copy(officialPath, basePath);
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
                {
                    logger.LogWarning(ex, "Could not restore the base copy of override {PluginId}", pluginId);
                }
            }
        }
    }

    private bool AdoptIfLocallyModified(string pluginId)
    {
        var officialPath = layout.GetPluginPath(PluginOrigin.Official, pluginId);
        var overridePath = layout.GetPluginPath(PluginOrigin.Override, pluginId);
        var recorded = stateStore.Load().Official.GetValueOrDefault(pluginId);
        if (recorded is null || !File.Exists(officialPath)
            || PluginStateStore.ComputeFileSha256(officialPath) == recorded.Sha256)
            return false;

        if (File.Exists(overridePath))
        {
            logger.LogWarning(
                "official/{PluginId}.yaml was changed on disk, but an override already exists, so it was left in place",
                pluginId);
            return false;
        }

        try
        {
            Directory.CreateDirectory(layout.OverridesDirectory);
            DeleteIfExists(layout.GetOverrideBasePath(pluginId));
            File.Move(officialPath, overridePath);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            logger.LogWarning(ex, "Could not move the locally modified official/{PluginId}.yaml to overrides/", pluginId);
            return false;
        }

        stateStore.Update(state => state.Overrides[pluginId] = new OverridePluginState(recorded.Version, recorded.Sha256));
        logger.LogWarning(
            "official/{PluginId}.yaml was changed on disk; it was moved to overrides/ with base version {Version}. Edit plugins in the UI instead",
            pluginId,
            recorded.Version);
        return true;
    }

    private string? ReadBaseContent(string pluginId, OverridePluginState? baseState)
    {
        var basePath = layout.GetOverrideBasePath(pluginId);
        if (File.Exists(basePath))
            return File.ReadAllText(basePath);

        var officialPath = layout.GetPluginPath(PluginOrigin.Official, pluginId);
        return baseState is not null && File.Exists(officialPath)
            && PluginStateStore.ComputeFileSha256(officialPath) == baseState.BaseSha256
            ? File.ReadAllText(officialPath)
            : null;
    }

    private bool MatchesBase(string yaml, string? baseContent, OverridePluginState? baseState) =>
        baseContent is not null
            ? PluginDefinitionComparer.AreSemanticallyEqual(yaml, baseContent, bases)
            : baseState is not null && PluginStateStore.ComputeSha256(Encoding.UTF8.GetBytes(yaml)) == baseState.BaseSha256;

    private void Remove(string pluginId)
    {
        DeleteIfExists(layout.GetPluginPath(PluginOrigin.Override, pluginId));
        DeleteIfExists(layout.GetOverrideBasePath(pluginId));
        if (stateStore.Load().Overrides.ContainsKey(pluginId))
            stateStore.Update(state => state.Overrides.Remove(pluginId));
    }

    private static void DeleteIfExists(string path)
    {
        if (File.Exists(path))
            File.Delete(path);
    }

    private void WriteAtomically(string path, string content)
    {
        var temporaryPath = Path.Combine(layout.OverridesDirectory, $".{Path.GetFileNameWithoutExtension(path)}.save");
        File.WriteAllText(temporaryPath, content);
        File.Move(temporaryPath, path, overwrite: true);
    }

    private string ReadVersion(string yaml) =>
        PluginDefinitionValidator.Validate(yaml, bases: bases).Definition?.Version ?? "";
}
