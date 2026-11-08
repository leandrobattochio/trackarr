using TrackerStats.Domain.Plugins.Yaml;

namespace TrackerStats.Infrastructure.Plugins.Storage;

public sealed class PluginBaseStore(string directory) : IPluginBaseLookup
{
    public PluginBaseStore(PluginStorageLayout layout)
        : this(layout.BasesDirectory)
    {
    }

    public string DirectoryPath { get; } = directory;

    public string? GetBaseContent(string baseId)
    {
        if (!PluginSchema.IsValidPluginId(baseId))
            return null;

        try
        {
            return File.ReadAllText(Path.Combine(DirectoryPath, $"{baseId}.yaml"));
        }
        catch (Exception ex) when (ex is FileNotFoundException or DirectoryNotFoundException)
        {
            return null;
        }
    }

    public IReadOnlyList<string> GetInstalledIds() =>
        Directory.Exists(DirectoryPath)
            ? Directory.EnumerateFiles(DirectoryPath, "*.yaml", SearchOption.TopDirectoryOnly)
                .Select(Path.GetFileNameWithoutExtension)
                .OfType<string>()
                .Where(PluginSchema.IsValidPluginId)
                .Order(StringComparer.Ordinal)
                .ToList()
            : [];
}
