namespace TrackerStats.Api.Controllers;

internal static class SnapshotRangeOptions
{
    private static readonly IReadOnlyDictionary<string, TimeSpan> Presets = new Dictionary<string, TimeSpan>(StringComparer.OrdinalIgnoreCase)
    {
        ["5m"] = TimeSpan.FromMinutes(5),
        ["15m"] = TimeSpan.FromMinutes(15),
        ["1h"] = TimeSpan.FromHours(1),
        ["6h"] = TimeSpan.FromHours(6),
        ["24h"] = TimeSpan.FromHours(24),
    };

    public static bool TryResolve(
        string? range,
        DateTime? from,
        DateTime? to,
        DateTimeOffset now,
        out SnapshotRangeResolution? resolution,
        out string? error)
    {
        resolution = null;
        error = null;

        if (string.IsNullOrWhiteSpace(range))
        {
            if (from.HasValue || to.HasValue)
                range = "custom";
            else
                range = "1h";
        }

        if (string.Equals(range, "custom", StringComparison.OrdinalIgnoreCase))
        {
            if (!from.HasValue || !to.HasValue)
            {
                error = "Query parameters 'from' and 'to' are required when range is 'custom'.";
                return false;
            }

            var normalizedFrom = NormalizeUtc(from.Value);
            var normalizedTo = NormalizeUtc(to.Value);
            if (normalizedFrom > normalizedTo)
            {
                error = "Query parameter 'from' must be less than or equal to 'to'.";
                return false;
            }

            resolution = new SnapshotRangeResolution("custom", normalizedFrom, normalizedTo);
            return true;
        }

        if (!Presets.TryGetValue(range, out var duration))
        {
            error = "Query parameter 'range' must be one of: 5m, 15m, 1h, 6h, 24h, custom.";
            return false;
        }

        var presetTo = NormalizeUtc(now.UtcDateTime);
        var presetFrom = presetTo.Subtract(duration);
        resolution = new SnapshotRangeResolution(range.ToLowerInvariant(), presetFrom, presetTo);
        return true;
    }

    private static DateTime NormalizeUtc(DateTime value) =>
        value.Kind == DateTimeKind.Utc
            ? value
            : DateTime.SpecifyKind(value, DateTimeKind.Utc);

    internal sealed record SnapshotRangeResolution(string Range, DateTime From, DateTime To);
}
