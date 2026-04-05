using System.Globalization;
using TrackerStats.Domain.Plugins.Yaml;

namespace TrackerStats.PluginEngine.Transforms;

public class IntegerTransformStrategy : ITransformStrategy
{
    public bool CanHandle(string transformName) =>
        transformName.Equals("integer", StringComparison.OrdinalIgnoreCase);

    public string Transform(string value) =>
        NumericParser.ParseInteger(value).ToString(CultureInfo.InvariantCulture);
}
