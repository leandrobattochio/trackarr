using System.Globalization;
using TrackerStats.Domain.Plugins.Yaml;

namespace TrackerStats.PluginEngine.Transforms;

public class ByteSizeTransformStrategy : ITransformStrategy
{
    public bool CanHandle(string transformName) =>
        transformName.Equals("bytesize", StringComparison.OrdinalIgnoreCase);

    public string Transform(string value) =>
        NumericParser.ParseByteSize(value).ToString(CultureInfo.InvariantCulture);
}
