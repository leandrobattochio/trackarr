using System.Globalization;
using System.Text.Json;
using TrackerStats.Domain.Plugins;

namespace TrackerStats.Plugin.Core.Unit3D;

public abstract class Unit3DTrackerPluginBase(PluginConfiguration? configuration = null)
    : TrackerPluginBase(configuration)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public override string PluginGroup => "unit3d";
    public override AuthMode AuthMode => AuthMode.ApiKey;

    public override IReadOnlyList<PluginField> Fields =>
    [
        new("cron", "Cron Expression", "cron", Required: true),
        new("required_ratio", "Required Ratio", "number", Required: true),
        new("baseUrl", "Base URL", "text", Required: true),
        new("apiKey", "API Key", "password", Required: true, Sensitive: true)
    ];

    public override void ConfigureHttpClient(HttpClient httpClient)
    {
        httpClient.BaseAddress = CreateBaseUri(GetRequiredFieldValue("baseUrl"));
        httpClient.DefaultRequestHeaders.Accept.ParseAdd("application/json");
        httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36");
    }

    public override async Task<TrackerFetchResult> FetchStatsAsync(HttpClient httpClient, CancellationToken ct)
    {
        try
        {
            using var request = new HttpRequestMessage(
                HttpMethod.Get,
                $"api/user?api_token={Uri.EscapeDataString(GetRequiredFieldValue("apiKey"))}");
            using var response = await httpClient.SendAsync(request, ct);

            if (response.StatusCode is System.Net.HttpStatusCode.Unauthorized or System.Net.HttpStatusCode.Forbidden)
                return new TrackerFetchResult(PluginProcessResult.AuthFailed);

            if (!response.IsSuccessStatusCode)
                return new TrackerFetchResult(PluginProcessResult.UnknownError);

            var responseBody = await response.Content.ReadAsStringAsync(ct);
            var user = JsonSerializer.Deserialize<Unit3DUserResponse>(responseBody, JsonOptions);

            if (user is null || string.IsNullOrWhiteSpace(user.Username))
                return new TrackerFetchResult(PluginProcessResult.UnknownError);

            var seedingTorrents = user.Seeding;
            var leechingTorrents = user.Leeching;

            return new TrackerFetchResult(
                PluginProcessResult.Success,
                new Domain.Plugins.TrackerStats(
                    Ratio: ParseDecimalValue(user.Ratio),
                    UploadedBytes: ParseByteSize(user.Uploaded),
                    DownloadedBytes: ParseByteSize(user.Downloaded),
                    SeedBonus: user.Seedbonus,
                    Buffer: user.Buffer,
                    HitAndRuns: user.Hit_and_runs,
                    RequiredRatio: ParseRequiredRatio(),
                    SeedingTorrents: seedingTorrents,
                    LeechingTorrents: leechingTorrents,
                    ActiveTorrents: seedingTorrents + leechingTorrents));
        }
        catch
        {
            return new TrackerFetchResult(PluginProcessResult.UnknownError);
        }
    }

    private decimal ParseRequiredRatio() =>
        decimal.Parse(GetRequiredFieldValue("required_ratio"), CultureInfo.InvariantCulture);

    private static Uri CreateBaseUri(string baseUrl)
    {
        if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var uri))
            throw new InvalidOperationException("The plugin baseUrl must be a valid absolute URL.");

        return uri;
    }

    protected static long ParseByteSize(string value)
    {
        var parts = value.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length != 2)
            throw new InvalidOperationException($"Invalid byte size value '{value}'.");

        var amount = decimal.Parse(parts[0], NumberStyles.Number, CultureInfo.InvariantCulture);
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

    private static decimal ParseDecimalValue(string value) =>
        decimal.Parse(value, NumberStyles.Number, CultureInfo.InvariantCulture);

    protected sealed record Unit3DUserResponse(
        string Username,
        string Group,
        string Uploaded,
        string Downloaded,
        string Ratio,
        string Buffer,
        int Seeding,
        int Leeching,
        string Seedbonus,
        int Hit_and_runs);
}
