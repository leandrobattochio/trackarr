using System.Globalization;
using TrackerStats.Domain.Plugins.Yaml;

namespace TrackerStats.PluginEngine.Transforms;

public class DecimalTransformStrategy : ITransformStrategy
{
    public bool CanHandle(string transformName) =>
        transformName.Equals("decimal", StringComparison.OrdinalIgnoreCase);

    public string Transform(string value) =>
        NumericParser.ParseDecimal(value).ToString(CultureInfo.InvariantCulture);
}
