using TrackerStats.Infrastructure.Plugins.Storage;

namespace TrackerStats.PluginEngine.IntegrationTests;

internal sealed class RepoPluginsDataDirectory : IDisposable
{
    private readonly string _root;

    private RepoPluginsDataDirectory(string root)
    {
        _root = root;
        Layout = PluginStorageLayout.ForDataDirectory(root);
    }

    public PluginStorageLayout Layout { get; }

    public static RepoPluginsDataDirectory Create()
    {
        var directory = new RepoPluginsDataDirectory(Path.Combine(Path.GetTempPath(), $"trackerstats-repo-plugins-{Guid.NewGuid():N}"));
        Directory.CreateDirectory(directory.Layout.OfficialDirectory);
        var fixturePlugins = Path.Combine(AppContext.BaseDirectory, "plugin-source", "plugins");
        foreach (var path in Directory.GetFiles(fixturePlugins, "*.yaml"))
            File.Copy(path, Path.Combine(directory.Layout.OfficialDirectory, Path.GetFileName(path)));

        return directory;
    }

    public void Dispose()
    {
        if (Directory.Exists(_root))
            Directory.Delete(_root, recursive: true);
    }
}
