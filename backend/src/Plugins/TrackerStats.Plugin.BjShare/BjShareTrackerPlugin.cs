using System.Globalization;
using TrackerStats.Domain.Plugins;

namespace TrackerStats.Plugin.BjShare;

public class BjShareTrackerPlugin(PluginConfiguration? configuration = null) : TrackerPluginBase(configuration)
{
    public override string PluginId => "bj-share";
    public override string PluginGroup => "bj-share";
    public override string DisplayName => "BJ-Share";
    public override AuthMode AuthMode => AuthMode.Cookie;

    public override IReadOnlyList<PluginField> Fields =>
    [
        new("cron", "Cron Expression", "cron", Required: true),
        new("required_ratio", "Required Ratio", "number", Required: true),
        new("baseUrl", "Base URL", "text", Required: true),
        new("cookie", "Cookie", "text", Required: true, Sensitive: true),
        new("username", "User Name", "text", Required: true)
    ];

    public override void ConfigureHttpClient(HttpClient httpClient)
    {
        httpClient.BaseAddress = CreateBaseUri(GetRequiredFieldValue("baseUrl"));
        httpClient.DefaultRequestHeaders.Accept.ParseAdd("application/json");
        httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36");
        httpClient.DefaultRequestHeaders.Add("Cookie", GetRequiredFieldValue("cookie"));
    }

    public override async Task<TrackerFetchResult> FetchStatsAsync(HttpClient httpClient, CancellationToken ct)
    {
        try
        {
            var username = GetRequiredFieldValue("username");

            var profilePage = await FetchProfilePageAsync(httpClient, username, ct);
            if (profilePage.Result is not PluginProcessResult.Success || profilePage.Stats is null)
                return new TrackerFetchResult(profilePage.Result);

            var seedingResult = await FetchTorrentCountAsync(httpClient, username, "seeding", ct);
            if (seedingResult.Result is not PluginProcessResult.Success || seedingResult.TorrentCount is null)
                return new TrackerFetchResult(seedingResult.Result);

            var leechingResult = await FetchTorrentCountAsync(httpClient, username, "leeching", ct);
            if (leechingResult.Result is not PluginProcessResult.Success || leechingResult.TorrentCount is null)
                return new TrackerFetchResult(leechingResult.Result);

            return new TrackerFetchResult(
                PluginProcessResult.Success,
                BuildTrackerStats(
                    profilePage.Stats.Value,
                    seedingResult.TorrentCount.Value,
                    leechingResult.TorrentCount.Value));
        }
        catch
        {
            return new TrackerFetchResult(PluginProcessResult.UnknownError);
        }
    }

    private async Task<ProfilePageFetchResult> FetchProfilePageAsync(HttpClient httpClient, string username, CancellationToken ct)
    {
        using var profileRequest = new HttpRequestMessage(HttpMethod.Post, $"user.php?username={Uri.EscapeDataString(username)}");
        using var profileResponse = await httpClient.SendAsync(profileRequest, ct);
        var profileHtml = await profileResponse.Content.ReadAsStringAsync(ct);

        if (profileResponse.StatusCode is System.Net.HttpStatusCode.Unauthorized or System.Net.HttpStatusCode.Forbidden)
            return new ProfilePageFetchResult(PluginProcessResult.AuthFailed);

        if (!profileResponse.IsSuccessStatusCode)
            return new ProfilePageFetchResult(PluginProcessResult.UnknownError);

        if (BjSharePageParser.LooksUnauthenticated(profileHtml))
            return new ProfilePageFetchResult(PluginProcessResult.AuthFailed);

        return new ProfilePageFetchResult(
            PluginProcessResult.Success,
            BjSharePageParser.ParseStats(profileHtml));
    }

    private static async Task<TorrentCountFetchResult> FetchTorrentCountAsync(HttpClient httpClient, string username, string type, CancellationToken ct)
    {
        try
        {
            using var request = new HttpRequestMessage(
                HttpMethod.Get,
                $"torrents.php?type={Uri.EscapeDataString(type)}&username={Uri.EscapeDataString(username)}");
            using var response = await httpClient.SendAsync(request, ct);
            var html = await response.Content.ReadAsStringAsync(ct);

            if (response.StatusCode is System.Net.HttpStatusCode.Unauthorized or System.Net.HttpStatusCode.Forbidden)
                return new TorrentCountFetchResult(PluginProcessResult.AuthFailed);

            if (!response.IsSuccessStatusCode)
                return new TorrentCountFetchResult(PluginProcessResult.UnknownError);

            if (BjSharePageParser.LooksUnauthenticated(html))
                return new TorrentCountFetchResult(PluginProcessResult.AuthFailed);

            return new TorrentCountFetchResult(
                PluginProcessResult.Success,
                BjSharePageParser.ParseTorrentCount(html));
        }
        catch
        {
            return new TorrentCountFetchResult(PluginProcessResult.UnknownError);
        }
    }

    private Domain.Plugins.TrackerStats BuildTrackerStats(ParsedStats parsedStats, int seedingTorrents, int leechingTorrents)
    {
        return new Domain.Plugins.TrackerStats(
            Ratio: parsedStats.Ratio,
            UploadedBytes: parsedStats.UploadedBytes,
            DownloadedBytes: parsedStats.DownloadedBytes,
            SeedBonus: parsedStats.BjPoints.ToString(CultureInfo.InvariantCulture),
            Buffer: null,
            HitAndRuns: null,
            RequiredRatio: ParseRequiredRatio(),
            SeedingTorrents: seedingTorrents,
            LeechingTorrents: leechingTorrents,
            ActiveTorrents: seedingTorrents + leechingTorrents);
    }

    private decimal ParseRequiredRatio() =>
        decimal.Parse(GetRequiredFieldValue("required_ratio"), CultureInfo.InvariantCulture);

    private static Uri CreateBaseUri(string baseUrl)
    {
        if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var uri))
            throw new InvalidOperationException("The plugin baseUrl must be a valid absolute URL.");

        return uri;
    }

    private readonly record struct ProfilePageFetchResult(
        PluginProcessResult Result,
        ParsedStats? Stats = null);
}
