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
        if (Directory.Exists(layout.OfficialDirectory) && Directory.EnumerateFiles(layout.OfficialDirectory, "*.yaml").Any())
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

        Directory.CreateDirectory(layout.OfficialDirectory);
        var seeded = new Dictionary<string, OfficialPluginState>(StringComparer.Ordinal);
        foreach (var entry in index.Plugins)
        {
            if (PluginSchema.GetCompatibility(entry.SchemaVersion) == PluginSchemaCompatibility.Incompatible)
            {
                logger.LogWarning("Snapshot plugin {PluginId} {Version} skipped: {Error}", entry.Id, entry.Version,
                    PluginSchema.GetUpdateRequiredMessage(entry.Id, entry.Version, entry.SchemaVersion));
                continue;
            }

            var sourcePath = Path.Combine(snapshotDirectory, entry.Path);
            if (!File.Exists(sourcePath))
            {
                logger.LogWarning("Snapshot plugin {PluginId} skipped: {Path} is missing", entry.Id, entry.Path);
                continue;
            }

            var content = File.ReadAllBytes(sourcePath);
            var sha256 = PluginStateStore.ComputeSha256(content);
            if (sha256 != entry.Sha256)
            {
                logger.LogWarning("Snapshot plugin {PluginId} skipped: sha256 of {Path} does not match the index", entry.Id, entry.Path);
                continue;
            }

            File.WriteAllBytes(layout.GetPluginPath(PluginOrigin.Official, entry.Id), content);
            seeded[entry.Id] = new OfficialPluginState(entry.Version, sha256);
        }

        if (seeded.Count > 0)
        {
            stateStore.Update(state =>
            {
                foreach (var (pluginId, official) in seeded)
                    state.Official[pluginId] = official;
            });
        }

        logger.LogInformation("Seeded {Count} official plugin(s) from the image snapshot: {PluginIds}",
            seeded.Count, string.Join(", ", seeded.Keys));
        return [.. seeded.Keys];
    }
}
