using System.Globalization;
using System.Text.RegularExpressions;
using TrackerStats.Domain.Plugins;

namespace TrackerStats.Plugin.BjShare;

internal static class BjSharePageParser
{
    public static bool LooksUnauthenticated(string pageHtml)
    {
        return
            pageHtml.Contains("Login", StringComparison.OrdinalIgnoreCase)
            || pageHtml.Contains("login.php", StringComparison.OrdinalIgnoreCase)
            || pageHtml.Contains("name=\"password\"", StringComparison.OrdinalIgnoreCase)
            || pageHtml.Contains("type=\"password\"", StringComparison.OrdinalIgnoreCase);
    }

    public static ParsedStats ParseStats(string pageHtml)
    {
        var uploadedText = MatchRequired(pageHtml, "<li\\s+class=\"tooltip\"\\s+title=\"(?<value>[^\"]+)\">\\s*Enviado:");
        var downloadedText = MatchRequired(pageHtml, "<li\\s+class=\"tooltip\"\\s+title=\"(?<value>[^\"]+)\">\\s*Baixado:");
        var ratioText = MatchRequired(pageHtml, "Ratio:\\s*<span[^>]*title=\"(?<value>[^\"]+)\"");
        var bjPointsText = ExtractBjPointsText(pageHtml);

        return new ParsedStats(
            UploadedBytes: ParseByteSize(uploadedText),
            DownloadedBytes: ParseByteSize(downloadedText),
            Ratio: ParseDecimalValue(ratioText),
            BjPoints: ParseLongValue(bjPointsText));
    }

    public static int ParseTorrentCount(string pageHtml)
    {
        var tableMatch = Regex.Match(
            pageHtml,
            "<table[^>]*class=\"[^\"]*torrent_table[^\"]*cats[^\"]*\"[^>]*>(?<table>.*?)</table>",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Singleline);

        if (!tableMatch.Success)
            return 0;

        var rowMatches = Regex.Matches(
            tableMatch.Groups["table"].Value,
            "<tr[^>]*class=\"[^\"]*torrent[^\"]*torrent_row[^\"]*\"[^>]*>",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Singleline);

        return rowMatches.Count;
    }

    private static string MatchRequired(string input, string pattern)
    {
        var match = Regex.Match(input, pattern, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
        if (!match.Success)
            throw new InvalidOperationException($"Failed to parse expected BJ-Share value with pattern '{pattern}'.");

        return match.Groups["value"].Value.Trim();
    }

    private static string ExtractBjPointsText(string pageHtml)
    {
        var liMatches = Regex.Matches(
            pageHtml,
            "<li[^>]*>(?<value>.*?)</li>",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Singleline);

        foreach (Match liMatch in liMatches)
        {
            var innerHtml = liMatch.Groups["value"].Value;
            if (!innerHtml.Contains("BJ-Pontos", StringComparison.OrdinalIgnoreCase))
                continue;

            var text = Regex.Replace(innerHtml, "<[^>]+>", string.Empty);
            text = Regex.Replace(text, "\\s+", " ").Trim();

            var valueMatch = Regex.Match(
                text,
                @"BJ-Pontos\s*:\s*(?<value>[\d\.,]+)",
                RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

            if (valueMatch.Success)
                return valueMatch.Groups["value"].Value;
        }

        throw new InvalidOperationException("Failed to parse BJ-Pontos from BJ-Share profile page.");
    }

    private static long ParseByteSize(string value)
    {
        var parts = value.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length != 2)
            throw new InvalidOperationException($"Invalid byte size value '{value}'.");

        var amount = ParseDecimalValue(parts[0]);
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

    private static decimal ParseDecimalValue(string value)
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

    private static long ParseLongValue(string value)
    {
        var normalized = value.Trim().Replace(".", string.Empty).Replace(",", string.Empty);
        if (long.TryParse(normalized, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed))
            return parsed;

        throw new InvalidOperationException($"Invalid integer value '{value}'.");
    }
}

internal readonly record struct ParsedStats(
    long UploadedBytes,
    long DownloadedBytes,
    decimal Ratio,
    long BjPoints);

internal readonly record struct TorrentCountFetchResult(
    PluginProcessResult Result,
    int? TorrentCount = null);
