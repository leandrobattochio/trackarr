using TrackerStats.Domain.Plugins;

namespace TrackerStats.Api;

public static class SyncResultNames
{
    public static string From(PluginProcessResult result) =>
        result switch
        {
            PluginProcessResult.Success => "success",
            PluginProcessResult.AuthFailed => "authFailed",
            _ => "unknownError"
        };
}
