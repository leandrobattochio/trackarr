using TrackerStats.Domain.Plugins;
using TrackerStats.Plugin.Core.Unit3D;

namespace TrackerStats.Plugin.Fearnopeer;

public class FearnopeerTrackerPlugin(PluginConfiguration? configuration = null) : Unit3DTrackerPluginBase(configuration)
{
    public override string PluginId => "fearnopeer";
    public override string DisplayName => "Fearnopeer";
}
