using TrackerStats.Domain.Plugins;

namespace TrackerStats.PluginEngine;

internal sealed class PluginFieldException(
    PluginProcessResult result,
    string? step,
    string field,
    string message,
    Exception? innerException = null) : InvalidOperationException(message, innerException)
{
    public PluginProcessResult Result { get; } = result;
    public string? Step { get; } = step;
    public string Field { get; } = field;
}
