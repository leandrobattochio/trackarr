namespace TrackerStats.Domain.Plugins.Yaml;

public interface ITransformStrategy
{
    bool CanHandle(string transformName);
    string Transform(string value);
}
