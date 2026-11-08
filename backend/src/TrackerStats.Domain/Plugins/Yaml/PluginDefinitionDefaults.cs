namespace TrackerStats.Domain.Plugins.Yaml;

public static class PluginDefinitionDefaults
{
    public static readonly IReadOnlyList<FieldDefinition> ReservedFields =
    [
        new() { Name = "cron", Label = "Cron Expression", Description = "Use a Hangfire cron expression in UTC, for example `0 * * * *` to run every hour.", Type = "cron", Required = true },
        new() { Name = "required_ratio", Label = "Required Ratio", Type = "number", Required = true }
    ];

    private static readonly HashSet<string> ReservedFieldNames =
        new([.. ReservedFields.Select(f => f.Name), "baseUrl"], StringComparer.OrdinalIgnoreCase);

    private static readonly IReadOnlyList<int> DefaultAuthFailureStatusCodes = [401, 403];

    public static bool IsReservedField(string fieldName) =>
        ReservedFieldNames.Contains(fieldName);

    public static string? GetReservedPropertyViolation(PluginDefinition definition)
    {
        var reservedFields = GetReservedFieldViolations(definition);
        if (reservedFields.Count > 0)
            return $"Fields [{string.Join(", ", reservedFields)}] are engine-owned and must not be declared in plugin YAML.";

        if (!string.IsNullOrWhiteSpace(definition.Http?.BaseUrl))
            return "Property 'http.baseUrl' is engine-owned and must not be declared in plugin YAML.";

        if (definition.Http?.Headers.ContainsKey("User-Agent") == true)
            return "Header 'http.headers.User-Agent' is engine-owned and must not be declared in plugin YAML.";

        if (definition.AuthFailure?.HttpStatusCodes.Count > 0)
            return "Property 'authFailure.httpStatusCodes' is engine-owned and must not be declared in plugin YAML.";

        return null;
    }

    public static IReadOnlyList<string> GetReservedFieldViolations(PluginDefinition definition) =>
        GetAllUserDefinedFields(definition)
            .Where(f => IsReservedField(f.Name))
            .Select(f => f.Name)
            .ToList();

    public static void ApplyDefaults(PluginDefinition definition, string userAgent)
    {
        var existingNames = new HashSet<string>(
            GetAllUserDefinedFields(definition).Select(f => f.Name),
            StringComparer.OrdinalIgnoreCase);

        var merged = new List<FieldDefinition>();
        foreach (var reserved in ReservedFields)
        {
            if (!existingNames.Contains(reserved.Name))
                merged.Add(reserved);
        }
        merged.AddRange(definition.Fields);
        definition.Fields = merged;
        definition.BaseUrls ??= [];
        definition.CustomFields ??= [];

        definition.Http ??= new HttpConfig();
        if (string.IsNullOrWhiteSpace(definition.Http.BaseUrl))
            definition.Http.BaseUrl = "{{baseUrl}}";

        if (!definition.Http.Headers.ContainsKey("User-Agent"))
            definition.Http.Headers["User-Agent"] = userAgent;

        if (definition.AuthFailure is null)
        {
            definition.AuthFailure = new AuthFailureConfig
            {
                HttpStatusCodes = new List<int>(DefaultAuthFailureStatusCodes)
            };
        }
        else if (definition.AuthFailure.HttpStatusCodes.Count == 0)
        {
            definition.AuthFailure.HttpStatusCodes = new List<int>(DefaultAuthFailureStatusCodes);
        }
    }

    public static IReadOnlyList<FieldDefinition> GetEffectiveFields(PluginDefinition definition) =>
        [.. definition.Fields, .. definition.CustomFields];

    private static IReadOnlyList<FieldDefinition> GetAllUserDefinedFields(PluginDefinition definition) =>
        [.. definition.Fields, .. definition.CustomFields];
}
