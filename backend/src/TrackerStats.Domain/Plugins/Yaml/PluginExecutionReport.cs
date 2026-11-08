namespace TrackerStats.Domain.Plugins.Yaml;

public sealed record PluginExecutionReport(
    PluginProcessResult Result,
    TrackerStats? Stats,
    IReadOnlyList<PluginStepReport> Steps,
    PluginFieldFailure? FailedField = null,
    string? Error = null)
{
    public TrackerFetchResult ToFetchResult() => new(Result, Stats);
}

// Path never carries the query string, and sensitive values are redacted from it.
public sealed record PluginStepReport(string Name, string Method, string Path, int StatusCode);

// Step is null for a mapping field.
public sealed record PluginFieldFailure(string? Step, string Field, string Error);
