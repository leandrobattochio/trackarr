using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using TrackerStats.Domain.Plugins.Yaml;

namespace TrackerStats.Infrastructure.Plugins.Storage;

public sealed class PluginStorageLayout
{
    public const string DataDirectoryKey = "Data:Directory";
    public const string DefaultDataDirectory = "/data";
    public const string BaseCopySuffix = ".base.yaml";

    public PluginStorageLayout(IConfiguration configuration, IHostEnvironment? hostEnvironment = null)
        : this(ResolveDataDirectory(configuration[DataDirectoryKey], hostEnvironment))
    {
    }

    private PluginStorageLayout(string dataDirectory)
    {
        DataDirectory = dataDirectory;
        PluginsRoot = Path.Combine(dataDirectory, "plugins");
        OfficialDirectory = Path.Combine(PluginsRoot, "official");
        OverridesDirectory = Path.Combine(PluginsRoot, "overrides");
        CustomDirectory = Path.Combine(PluginsRoot, "custom");
        StateFilePath = Path.Combine(PluginsRoot, "state.json");
    }

    public static PluginStorageLayout ForDataDirectory(string dataDirectory) =>
        new(Path.GetFullPath(dataDirectory));

    public string DataDirectory { get; }
    public string PluginsRoot { get; }
    public string OfficialDirectory { get; }
    public string OverridesDirectory { get; }
    public string CustomDirectory { get; }
    public string StateFilePath { get; }

    public string GetDirectory(PluginOrigin origin) => origin switch
    {
        PluginOrigin.Official => OfficialDirectory,
        PluginOrigin.Override => OverridesDirectory,
        PluginOrigin.Custom => CustomDirectory,
        _ => throw new ArgumentOutOfRangeException(nameof(origin), origin, null)
    };

    public string GetPluginPath(PluginOrigin origin, string pluginId) =>
        Path.Combine(GetDirectory(origin), $"{EnsureValidPluginId(pluginId)}.yaml");

    public string GetOverrideBasePath(string pluginId) =>
        Path.Combine(OverridesDirectory, $"{EnsureValidPluginId(pluginId)}{BaseCopySuffix}");

    private static string EnsureValidPluginId(string pluginId) =>
        PluginSchema.IsValidPluginId(pluginId)
            ? pluginId
            : throw new ArgumentException(PluginSchema.GetInvalidPluginIdMessage(pluginId), nameof(pluginId));

    private static string ResolveDataDirectory(string? configured, IHostEnvironment? hostEnvironment)
    {
        var directory = string.IsNullOrWhiteSpace(configured) ? DefaultDataDirectory : configured;
        if (Path.IsPathRooted(directory))
            return Path.GetFullPath(directory);

        var basePath = string.IsNullOrWhiteSpace(hostEnvironment?.ContentRootPath)
            ? AppContext.BaseDirectory
            : hostEnvironment.ContentRootPath;
        return Path.GetFullPath(Path.Combine(basePath, directory));
    }
}
