namespace TrackerStats.Domain.Plugins.Yaml;

public class AuthFailureConfig
{
    public List<int> HttpStatusCodes { get; set; } = [];
    public List<string> HtmlPatterns { get; set; } = [];
}
