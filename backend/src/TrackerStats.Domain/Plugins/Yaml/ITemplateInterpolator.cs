namespace TrackerStats.Domain.Plugins.Yaml;

public interface ITemplateInterpolator
{
    string InterpolateTemplate(
        string template,
        PluginConfiguration configuration,
        Dictionary<string, Dictionary<string, string>> stepResults);

    string InterpolateFieldValues(string template, PluginConfiguration configuration);
}
