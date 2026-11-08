using TrackerStats.Infrastructure.Plugins.Storage;

namespace TrackerStats.Api.EndToEndTests;

internal static class RepoPlugins
{
    public const string SourceUrlEnvVar = "PluginSource__Url";
    public const string AppReleasesUrlEnvVar = "AppReleases__Url";

    // Nothing listens on the discard port, so the release check fails fast instead of calling GitHub.
    public const string OfflineAppReleasesUrl = "http://127.0.0.1:9/releases";

    // A missing file:// folder: the startup download fails fast and leaves the seeded plugins alone.
    public static string OfflineSourceUrl(string dataDirectory) =>
        new Uri(Path.Combine(dataDirectory, "no-plugin-source")).AbsoluteUri;

    public static void CopyToOfficial(string dataDirectory)
    {
        var fixturePlugins = Path.Combine(AppContext.BaseDirectory, "plugin-source", "plugins");
        var officialDirectory = PluginStorageLayout.ForDataDirectory(dataDirectory).OfficialDirectory;
        Directory.CreateDirectory(officialDirectory);
        foreach (var path in Directory.GetFiles(fixturePlugins, "*.yaml"))
            File.Copy(path, Path.Combine(officialDirectory, Path.GetFileName(path)));
    }
}
