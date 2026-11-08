using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;

namespace TrackerStats.Infrastructure.Plugins.Storage;

public sealed partial class LegacyPluginCleanup(
    PluginStorageLayout layout,
    PluginStateStore stateStore,
    ILogger<LegacyPluginCleanup> logger)
{
    private IEnumerable<string> LegacyDirectories =>
        [layout.DataDirectory, Path.Combine(layout.DataDirectory, "templates")];

    public IReadOnlyList<string> Run()
    {
        if (stateStore.Load().LegacyCleanupCompletedAt is not null)
            return [];

        var deleted = new List<string>();
        var failed = false;
        foreach (var path in LegacyDirectories.Where(Directory.Exists)
                     .SelectMany(directory => Directory.GetFiles(directory, "*.yaml", SearchOption.TopDirectoryOnly))
                     .Where(IsPluginFile))
        {
            try
            {
                File.Delete(path);
                deleted.Add(path);
                logger.LogInformation("Deleted legacy v0.3 plugin file {Path}", path);
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                failed = true;
                logger.LogWarning(ex, "Could not delete legacy v0.3 plugin file {Path}; retrying on next start", path);
            }
        }

        if (!failed)
        {
            stateStore.Update(state => state.LegacyCleanupCompletedAt = DateTimeOffset.UtcNow);
            logger.LogInformation("Legacy v0.3 plugin cleanup completed, {Count} file(s) deleted", deleted.Count);
        }

        return deleted;
    }

    private bool IsPluginFile(string path)
    {
        try
        {
            return PluginIdKeyRegex().IsMatch(File.ReadAllText(path));
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            logger.LogWarning(ex, "Could not read {Path}; it is kept", path);
            return false;
        }
    }

    [GeneratedRegex(@"^pluginId\s*:", RegexOptions.Multiline)]
    private static partial Regex PluginIdKeyRegex();
}
