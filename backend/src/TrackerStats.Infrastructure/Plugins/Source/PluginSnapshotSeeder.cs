using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using TrackerStats.Domain.Plugins.Yaml;
using TrackerStats.Infrastructure.Plugins.Storage;

namespace TrackerStats.Infrastructure.Plugins.Source;

public sealed class PluginSnapshotSeeder(
    IConfiguration configuration,
    PluginStorageLayout layout,
    PluginStateStore stateStore,
    ILogger<PluginSnapshotSeeder> logger)
{
    public const string SnapshotDirectoryKey = "PluginSource:SnapshotDirectory";
    public const string DefaultSnapshotDirectoryName = "plugin-snapshot";

    private string SnapshotDirectory
    {
        get
        {
            var configured = configuration[SnapshotDirectoryKey];
            return string.IsNullOrWhiteSpace(configured)
                ? Path.Combine(AppContext.BaseDirectory, DefaultSnapshotDirectoryName)
                : Path.GetFullPath(configured);
        }
    }

    public IReadOnlyList<string> Run()
    {
        var seedPlugins = !HasYamlFiles(layout.OfficialDirectory);
        // Checked on its own: an install upgraded from a trackarr without bases has plugins but no bases yet.
        var seedBases = !HasYamlFiles(layout.BasesDirectory);
        if (!seedPlugins && !seedBases)
            return [];

        var snapshotDirectory = SnapshotDirectory;
        var indexPath = Path.Combine(snapshotDirectory, PluginIndexClient.IndexFileName);
        if (!File.Exists(indexPath))
        {
            logger.LogInformation("No plugin snapshot at {SnapshotDirectory}; official plugins come from the startup download", snapshotDirectory);
            return [];
        }

        PluginIndex index;
        try
        {
            index = PluginIndexParser.Parse(File.ReadAllBytes(indexPath));
        }
        catch (FormatException ex)
        {
            logger.LogWarning("Plugin snapshot at {SnapshotDirectory} is unusable: {Error}", snapshotDirectory, ex.Message);
            return [];
        }

        var seededBases = seedBases
            ? Seed(index.Bases, snapshotDirectory, "base", layout.BasesDirectory, layout.GetBasePath)
            : [];
        var seeded = seedPlugins
            ? Seed(index.Plugins, snapshotDirectory, "plugin", layout.OfficialDirectory,
                pluginId => layout.GetPluginPath(PluginOrigin.Official, pluginId))
            : [];

        if (seeded.Count > 0 || seededBases.Count > 0)
        {
            stateStore.Update(state =>
            {
                foreach (var (pluginId, official) in seeded)
                    state.Official[pluginId] = official;
                foreach (var (baseId, installedBase) in seededBases)
                    state.Bases[baseId] = installedBase;
            });
        }

        if (seedBases && index.Bases.Count > 0)
        {
            logger.LogInformation("Seeded {Count} plugin base(s) from the image snapshot: {BaseIds}",
                seededBases.Count, string.Join(", ", seededBases.Keys));
        }

        if (seedPlugins)
        {
            logger.LogInformation("Seeded {Count} official plugin(s) from the image snapshot: {PluginIds}",
                seeded.Count, string.Join(", ", seeded.Keys));
        }

        return [.. seeded.Keys];
    }

    private Dictionary<string, OfficialPluginState> Seed(
        IReadOnlyList<PluginIndexEntry> entries,
        string snapshotDirectory,
        string kind,
        string targetDirectory,
        Func<string, string> getTargetPath)
    {
        var seeded = new Dictionary<string, OfficialPluginState>(StringComparer.Ordinal);
        if (entries.Count == 0)
            return seeded;

        Directory.CreateDirectory(targetDirectory);
        foreach (var entry in entries)
        {
            if (PluginSchema.GetCompatibility(entry.SchemaVersion) == PluginSchemaCompatibility.Incompatible)
            {
                logger.LogWarning("Snapshot {Kind} {Id} {Version} skipped: {Error}", kind, entry.Id, entry.Version,
                    PluginSchema.GetUpdateRequiredMessage(entry.Id, entry.Version, entry.SchemaVersion));
                continue;
            }

            var sourcePath = Path.Combine(snapshotDirectory, entry.Path);
            if (!File.Exists(sourcePath))
            {
                logger.LogWarning("Snapshot {Kind} {Id} skipped: {Path} is missing", kind, entry.Id, entry.Path);
                continue;
            }

            var content = File.ReadAllBytes(sourcePath);
            var sha256 = PluginStateStore.ComputeSha256(content);
            if (sha256 != entry.Sha256)
            {
                logger.LogWarning("Snapshot {Kind} {Id} skipped: sha256 of {Path} does not match the index", kind, entry.Id, entry.Path);
                continue;
            }

            File.WriteAllBytes(getTargetPath(entry.Id), content);
            seeded[entry.Id] = new OfficialPluginState(entry.Version, sha256);
        }

        return seeded;
    }

    private static bool HasYamlFiles(string directory) =>
        Directory.Exists(directory) && Directory.EnumerateFiles(directory, "*.yaml").Any();
}
