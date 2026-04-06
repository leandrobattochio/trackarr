namespace TrackerStats.Domain.Plugins.Yaml;

public static class PluginDefinitionDefaults
{
    public static readonly IReadOnlyList<FieldDefinition> ReservedFields =
    [
        new() { Name = "cron", Label = "Cron Expression", Type = "cron", Required = true },
        new() { Name = "required_ratio", Label = "Required Ratio", Type = "number", Required = true },
        new() { Name = "baseUrl", Label = "Base URL", Type = "text", Required = true }
    ];

    private static readonly HashSet<string> ReservedFieldNames =
        new(ReservedFields.Select(f => f.Name), StringComparer.OrdinalIgnoreCase);

    private static readonly IReadOnlyList<int> DefaultAuthFailureStatusCodes = [401, 403];

    private const string DefaultUserAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";

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

    public static void ApplyDefaults(PluginDefinition definition)
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
        definition.CustomFields ??= [];

        definition.Http ??= new HttpConfig();
        if (string.IsNullOrWhiteSpace(definition.Http.BaseUrl))
            definition.Http.BaseUrl = "{{baseUrl}}";

        if (!definition.Http.Headers.ContainsKey("User-Agent"))
            definition.Http.Headers["User-Agent"] = DefaultUserAgent;

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

    public static PluginDefinition CreateEditableDefinition(PluginDefinition definition)
    {
        return new PluginDefinition
        {
            PluginId = definition.PluginId,
            DisplayName = definition.DisplayName,
            Fields = definition.Fields
                .Where(field => !IsReservedField(field.Name))
                .Select(field => new FieldDefinition
                {
                    Name = field.Name,
                    Label = field.Label,
                    Type = field.Type,
                    Required = field.Required,
                    Sensitive = field.Sensitive
                })
                .ToList(),
            CustomFields = definition.CustomFields
                .Select(field => new FieldDefinition
                {
                    Name = field.Name,
                    Label = field.Label,
                    Type = field.Type,
                    Required = field.Required,
                    Sensitive = field.Sensitive
                })
                .ToList(),
            Http = CreateEditableHttp(definition.Http),
            AuthFailure = CreateEditableAuthFailure(definition.AuthFailure),
            Steps = definition.Steps,
            Mapping = definition.Mapping,
            Dashboard = definition.Dashboard
        };
    }

    public static IReadOnlyList<FieldDefinition> GetEffectiveFields(PluginDefinition definition) =>
        [.. definition.Fields, .. definition.CustomFields];

    private static IReadOnlyList<FieldDefinition> GetAllUserDefinedFields(PluginDefinition definition) =>
        [.. definition.Fields, .. definition.CustomFields];

    private static HttpConfig? CreateEditableHttp(HttpConfig? http)
    {
        if (http is null)
            return null;

        var headers = http.Headers
            .Where(header => !string.Equals(header.Key, "User-Agent", StringComparison.OrdinalIgnoreCase))
            .ToDictionary(header => header.Key, header => header.Value, StringComparer.OrdinalIgnoreCase);

        if (string.IsNullOrWhiteSpace(http.BaseUrl) && headers.Count == 0 && http.Cookies.Count == 0)
            return null;

        return new HttpConfig
        {
            Headers = headers,
            Cookies = new Dictionary<string, string>(http.Cookies, StringComparer.OrdinalIgnoreCase)
        };
    }

    private static AuthFailureConfig? CreateEditableAuthFailure(AuthFailureConfig? authFailure)
    {
        if (authFailure is null)
            return null;

        if (authFailure.HtmlPatterns.Count == 0)
            return null;

        return new AuthFailureConfig
        {
            HtmlPatterns = new List<string>(authFailure.HtmlPatterns)
        };
    }
}
