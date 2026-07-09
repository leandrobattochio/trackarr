using System.Net.Http.Json;
using System.Text.Json.Serialization;
using TrackerStats.Domain.Services;

namespace TrackerStats.Infrastructure.Services;

public sealed class GitHubUpdateCheckService(
    IHttpClientFactory httpClientFactory,
    IApplicationSettingsService settingsService) : IUpdateCheckService
{
    private static readonly TimeSpan CacheDuration = TimeSpan.FromHours(6);
    private readonly Lock _cacheLock = new();
    private CacheEntry? _cache;

    public async Task<UpdateCheckSnapshot> CheckAsync(string currentVersion, CancellationToken ct)
    {
        var settings = settingsService.GetRequired();
        if (!settings.CheckForUpdates)
            return Disabled(currentVersion);

        CacheEntry? cached;
        lock (_cacheLock)
        {
            cached = _cache;
        }

        if (cached is not null && DateTimeOffset.UtcNow - cached.CheckedAt < CacheDuration)
            return CreateSnapshot(currentVersion, cached);

        try
        {
            var client = httpClientFactory.CreateClient("github-releases");
            using var response = await client.GetAsync("/repos/leandrobattochio/trackarr/releases/latest", ct);
            response.EnsureSuccessStatusCode();

            var release = await response.Content.ReadFromJsonAsync<GitHubReleaseResponse>(cancellationToken: ct);
            if (release is null || string.IsNullOrWhiteSpace(release.TagName))
                return Failed(currentVersion, "GitHub did not return a release tag.");

            var entry = new CacheEntry(
                NormalizeVersion(release.TagName),
                release.HtmlUrl,
                DateTimeOffset.UtcNow,
                null);

            lock (_cacheLock)
            {
                _cache = entry;
            }

            return CreateSnapshot(currentVersion, entry);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or NotSupportedException)
        {
            if (ct.IsCancellationRequested)
                throw;

            var entry = new CacheEntry(null, null, DateTimeOffset.UtcNow, ex.Message);
            lock (_cacheLock)
            {
                _cache = entry;
            }

            return CreateSnapshot(currentVersion, entry);
        }
    }

    private static UpdateCheckSnapshot Disabled(string currentVersion) =>
        new(false, NormalizeVersion(currentVersion), null, false, null, null, null);

    private static UpdateCheckSnapshot Failed(string currentVersion, string error) =>
        new(true, NormalizeVersion(currentVersion), null, false, null, DateTimeOffset.UtcNow, error);

    private static UpdateCheckSnapshot CreateSnapshot(string currentVersion, CacheEntry entry)
    {
        var normalizedCurrentVersion = NormalizeVersion(currentVersion);
        var updateAvailable = entry.LatestVersion is not null
            && TryCompareVersions(entry.LatestVersion, normalizedCurrentVersion, out var comparison)
            && comparison > 0;

        return new UpdateCheckSnapshot(
            true,
            normalizedCurrentVersion,
            entry.LatestVersion,
            updateAvailable,
            entry.ReleaseUrl,
            entry.CheckedAt,
            entry.Error);
    }

    private static string NormalizeVersion(string version) =>
        version.Trim().TrimStart('v', 'V');

    private static bool TryCompareVersions(string latest, string current, out int comparison)
    {
        comparison = 0;
        var latestCore = latest.Split('-', 2)[0];
        var currentCore = current.Split('-', 2)[0];

        if (!Version.TryParse(latestCore, out var latestVersion) ||
            !Version.TryParse(currentCore, out var currentVersion))
            return false;

        comparison = latestVersion.CompareTo(currentVersion);
        return true;
    }

    private sealed record CacheEntry(
        string? LatestVersion,
        string? ReleaseUrl,
        DateTimeOffset CheckedAt,
        string? Error);

    private sealed record GitHubReleaseResponse(
        [property: JsonPropertyName("tag_name")] string? TagName,
        [property: JsonPropertyName("html_url")] string? HtmlUrl);
}
