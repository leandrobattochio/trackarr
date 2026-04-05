using System.Globalization;

namespace TrackerStats.PluginEngine;

internal static class NumericParser
{
    public static decimal ParseDecimal(string value)
    {
        var trimmed = value.Trim();

        if (trimmed.Contains(','))
        {
            var normalized = trimmed.Replace(".", string.Empty).Replace(",", ".");
            if (decimal.TryParse(normalized, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsedComma))
                return parsedComma;
        }

        if (decimal.TryParse(trimmed, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed))
            return parsed;

        throw new InvalidOperationException($"Invalid numeric value '{value}'.");
    }

    public static int ParseInteger(string value)
    {
        var normalized = value.Trim().Replace(".", string.Empty).Replace(",", string.Empty);
        if (int.TryParse(normalized, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed))
            return parsed;

        throw new InvalidOperationException($"Invalid integer value '{value}'.");
    }

    public static long ParseByteSize(string value)
    {
        var parts = value.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length != 2)
            throw new InvalidOperationException($"Invalid byte size value '{value}'.");

        var amount = ParseDecimal(parts[0]);
        var multiplier = parts[1].ToUpperInvariant() switch
        {
            "B" => 1m,
            "KIB" => 1024m,
            "MIB" => 1024m * 1024m,
            "GIB" => 1024m * 1024m * 1024m,
            "TIB" => 1024m * 1024m * 1024m * 1024m,
            "PIB" => 1024m * 1024m * 1024m * 1024m * 1024m,
            _ => throw new InvalidOperationException($"Unsupported byte unit '{parts[1]}'.")
        };

        return decimal.ToInt64(decimal.Round(amount * multiplier, MidpointRounding.AwayFromZero));
    }
}
