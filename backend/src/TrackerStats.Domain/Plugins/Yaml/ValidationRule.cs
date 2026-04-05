namespace TrackerStats.Domain.Plugins.Yaml;

public class ValidationRule
{
    public required string Field { get; set; }
    public required string Rule { get; set; }
    public string OnFail { get; set; } = "unknownError";
}
