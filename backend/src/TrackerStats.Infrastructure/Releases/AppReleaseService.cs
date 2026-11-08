using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using TrackerStats.Domain.Plugins.Yaml;

namespace TrackerStats.Infrastructure.Releases;

public sealed record AppRelease(
    string Version,
    string TagName,
    string? Name,
    string? Url,
    DateTimeOffset? PublishedAt,
    string Notes);

public enum AppReleaseStatus
{
    Available,
    Unavailable
}

public sealed record AppReleaseReport(
    AppReleaseStatus Status,
    string InstalledVersion,
    AppRelease? LatestRelease,
    bool UpdateAvailable,
    IReadOnlyList<AppRelease> Releases,
    DateTimeOffset CheckedAt,
    string? Error);

public sealed class AppReleaseService(
    IConfiguration configuration,
    IHttpClientFactory httpClientFactory,
    InstalledAppVersion installedVersion,
    ILogger<AppReleaseService> logger)
{
    public const string HttpClientName = "GitHubReleases";
    public const string UrlKey = "AppReleases:Url";
    public const string DefaultUrl = "https://api.github.com/repos/leandrobattochio/trackarr/releases?per_page=100";

    private static readonly TimeSpan CheckLifetime = TimeSpan.FromHours(12);
    private static readonly TimeSpan FailedCheckLifetime = TimeSpan.FromMinutes(5);

    private readonly Lock _gate = new();
    private Task<ReleaseCheck>? _check;

    public string InstalledVersion => InstalledAppVersion.Normalize(installedVersion.Value);

    public Task EnsureCheckedAsync() => GetCheckAsync();

    /// <param name="sinceVersion">Last-read app version; null when none was read yet.</param>
    public async Task<AppReleaseReport> GetReportAsync(string? sinceVersion, CancellationToken cancellationToken = default)
    {
        var check = await GetCheckAsync().WaitAsync(cancellationToken);
        var installed = InstalledVersion;
        if (check.Error is not null)
            return new AppReleaseReport(AppReleaseStatus.Unavailable, installed, null, false, [], check.CheckedAt, check.Error);

        var installedIsSemver = PluginSchema.IsSemanticVersion(installed);
        var since = sinceVersion is null ? null : InstalledAppVersion.Normalize(sinceVersion);
        var latest = check.Releases.FirstOrDefault();
        var updateAvailable = installedIsSemver && latest is not null
            && PluginSchema.CompareVersions(latest.Version, installed) > 0;
        var unread = check.Releases
            .Where(release => since is null || PluginSchema.CompareVersions(release.Version, since) > 0)
            .Where(release => !installedIsSemver || PluginSchema.CompareVersions(release.Version, installed) <= 0)
            .ToList();

        return new AppReleaseReport(AppReleaseStatus.Available, installed, latest, updateAvailable, unread, check.CheckedAt, null);
    }

    public static bool IsValidVersion(string version) =>
        PluginSchema.IsSemanticVersion(InstalledAppVersion.Normalize(version));

    private Task<ReleaseCheck> GetCheckAsync()
    {
        lock (_gate)
        {
            if (_check is { IsCompleted: true } && (!_check.IsCompletedSuccessfully || IsExpired(_check.Result)))
                _check = null;
            return _check ??= Task.Run(FetchAsync);
        }
    }

    private static bool IsExpired(ReleaseCheck check) =>
        DateTimeOffset.UtcNow - check.CheckedAt >= (check.Error is null ? CheckLifetime : FailedCheckLifetime);

    private async Task<ReleaseCheck> FetchAsync()
    {
        var url = configuration[UrlKey];
        if (string.IsNullOrWhiteSpace(url))
            url = DefaultUrl;

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, url.Trim());
            request.Headers.Accept.ParseAdd("application/vnd.github+json");
            request.Headers.Add("X-GitHub-Api-Version", "2022-11-28");
            request.Headers.UserAgent.ParseAdd($"trackarr/{UserAgentVersion()}");

            using var client = httpClientFactory.CreateClient(HttpClientName);
            using var response = await client.SendAsync(request);
            if (!response.IsSuccessStatusCode)
                return Failed(DescribeStatus(response.StatusCode));

            await using var stream = await response.Content.ReadAsStreamAsync();
            var releases = Parse(await JsonDocument.ParseAsync(stream));
            logger.LogInformation(
                "GitHub Releases: {Count} releases, latest {Latest}, installed {Installed}",
                releases.Count,
                releases.FirstOrDefault()?.Version ?? "none",
                InstalledVersion);
            return new ReleaseCheck(DateTimeOffset.UtcNow, releases, null);
        }
        catch (HttpRequestException ex)
        {
            return Failed($"Could not reach the GitHub Releases API: {ex.Message}");
        }
        catch (OperationCanceledException)
        {
            return Failed("The GitHub Releases API did not answer in time.");
        }
        catch (Exception ex) when (ex is JsonException or IOException)
        {
            return Failed($"The GitHub Releases API returned an unexpected response: {ex.Message}");
        }
        catch (Exception ex) when (ex is UriFormatException or NotSupportedException or InvalidOperationException)
        {
            return Failed($"The release URL '{url}' is invalid: {ex.Message}");
        }
    }

    private ReleaseCheck Failed(string error)
    {
        logger.LogWarning("Could not load trackarr release notes: {Error}", error);
        return new ReleaseCheck(DateTimeOffset.UtcNow, [], error);
    }

    private string UserAgentVersion()
    {
        var version = InstalledVersion;
        return PluginSchema.IsSemanticVersion(version) ? version : "unknown";
    }

    private static string DescribeStatus(HttpStatusCode statusCode) => statusCode switch
    {
        HttpStatusCode.Forbidden or HttpStatusCode.TooManyRequests =>
            $"The GitHub Releases API rate limit was reached (HTTP {(int)statusCode}). Restart trackarr later to check again.",
        _ => $"The GitHub Releases API returned HTTP {(int)statusCode}."
    };

    private static List<AppRelease> Parse(JsonDocument document)
    {
        using (document)
        {
            if (document.RootElement.ValueKind != JsonValueKind.Array)
                throw new JsonException("Expected a JSON array of releases.");

            var releases = new List<AppRelease>();
            foreach (var item in document.RootElement.EnumerateArray())
            {
                if (item.ValueKind != JsonValueKind.Object || IsTrue(item, "draft") || IsTrue(item, "prerelease"))
                    continue;

                var tagName = GetString(item, "tag_name");
                if (tagName is null)
                    continue;
                var version = InstalledAppVersion.Normalize(tagName);
                if (!PluginSchema.IsSemanticVersion(version))
                    continue;

                DateTimeOffset? publishedAt = item.TryGetProperty("published_at", out var published)
                    && published.ValueKind == JsonValueKind.String
                    && published.TryGetDateTimeOffset(out var date)
                        ? date
                        : null;
                releases.Add(new AppRelease(
                    version,
                    tagName,
                    GetString(item, "name"),
                    GetString(item, "html_url"),
                    publishedAt,
                    GetString(item, "body") ?? string.Empty));
            }

            releases.Sort((left, right) => PluginSchema.CompareVersions(right.Version, left.Version));
            return releases;
        }
    }

    private static bool IsTrue(JsonElement item, string property) =>
        item.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.True;

    private static string? GetString(JsonElement item, string property) =>
        item.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    private sealed record ReleaseCheck(DateTimeOffset CheckedAt, IReadOnlyList<AppRelease> Releases, string? Error);
}
