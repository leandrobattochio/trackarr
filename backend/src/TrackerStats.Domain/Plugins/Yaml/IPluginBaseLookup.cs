namespace TrackerStats.Domain.Plugins.Yaml;

public interface IPluginBaseLookup
{
    string? GetBaseContent(string baseId);
}
