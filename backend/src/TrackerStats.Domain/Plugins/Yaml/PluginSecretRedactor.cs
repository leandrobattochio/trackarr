namespace TrackerStats.Domain.Plugins.Yaml;

public sealed class PluginSecretRedactor
{
    public const string Mask = "***";

    private const int MinimumSecretLength = 4;

    private static readonly HashSet<string> SecretFieldNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "cookie", "apiKey", "password", "passkey", "token"
    };

    private readonly IReadOnlyList<string> _secrets;

    private PluginSecretRedactor(IReadOnlyList<string> secrets) => _secrets = secrets;

    public static PluginSecretRedactor Create(PluginDefinition definition, PluginConfiguration configuration)
    {
        var secrets = PluginDefinitionDefaults.GetEffectiveFields(definition)
            .Where(field => field.Sensitive || SecretFieldNames.Contains(field.Name))
            .Select(field => configuration.GetValue(field.Name))
            .Where(value => value is not null && value.Trim().Length >= MinimumSecretLength)
            .SelectMany(value => new[] { value!, value!.Trim(), Uri.EscapeDataString(value!.Trim()) })
            .Distinct(StringComparer.Ordinal)
            .OrderByDescending(value => value.Length)
            .ToList();

        return new PluginSecretRedactor(secrets);
    }

    public string Redact(string text) =>
        _secrets.Aggregate(text, (current, secret) => current.Replace(secret, Mask, StringComparison.Ordinal));
}
