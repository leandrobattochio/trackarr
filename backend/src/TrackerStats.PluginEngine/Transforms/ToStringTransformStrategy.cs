using TrackerStats.Domain.Plugins.Yaml;

namespace TrackerStats.PluginEngine.Transforms;

public class ToStringTransformStrategy : ITransformStrategy
{
    public bool CanHandle(string transformName) =>
        transformName.Equals("tostring", StringComparison.OrdinalIgnoreCase);

    public string Transform(string value) => value.Trim();
}
