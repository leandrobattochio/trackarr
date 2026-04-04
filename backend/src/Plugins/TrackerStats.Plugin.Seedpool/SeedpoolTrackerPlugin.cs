using TrackerStats.Domain.Plugins;
using TrackerStats.Plugin.Core.Unit3D;

namespace TrackerStats.Plugin.Seedpool;

public class SeedpoolTrackerPlugin(PluginConfiguration? configuration = null) : Unit3DTrackerPluginBase(configuration)
{
    public override string PluginId => "seedpool";
    public override string DisplayName => "Seedpool";
}
