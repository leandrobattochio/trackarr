namespace TrackerStats.Domain.Plugins;

public class PluginConfiguration(IReadOnlyDictionary<string, string?> values)
{
    private readonly IReadOnlyDictionary<string, string?> _values = new Dictionary<string, string?>(values, StringComparer.OrdinalIgnoreCase);

    public string? GetValue(string fieldName) =>
        _values.TryGetValue(fieldName, out var value) ? value : null;

    public string GetRequiredValue(string fieldName)
    {
        var value = GetValue(fieldName);
        if (string.IsNullOrWhiteSpace(value))
            throw new InvalidOperationException($"Required plugin field '{fieldName}' is missing.");

        return value;
    }
}
