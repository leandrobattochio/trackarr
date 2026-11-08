using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;
using TrackerStats.Api.Controllers;
using TrackerStats.Infrastructure.Releases;

namespace TrackerStats.Backend.Tests;

public sealed class AppReleaseServiceTests
{
    private const string ReleasesJson = """
        [
          { "tag_name": "v0.6.0-rc.1", "name": "v0.6.0-rc.1", "html_url": "https://github.com/leandrobattochio/trackarr/releases/tag/v0.6.0-rc.1", "body": "rc", "draft": false, "prerelease": true, "published_at": "2026-12-20T10:00:00Z" },
          { "tag_name": "v0.4.0", "name": "v0.4.0", "html_url": "https://github.com/leandrobattochio/trackarr/releases/tag/v0.4.0", "body": "### Changed\n- plugins come from trackarr-plugins", "draft": false, "prerelease": false, "published_at": "2026-11-10T10:00:00Z" },
          { "tag_name": "v0.5.0", "name": "v0.5.0", "html_url": "https://github.com/leandrobattochio/trackarr/releases/tag/v0.5.0", "body": "### Added\n- something new", "draft": false, "prerelease": false, "published_at": "2026-12-01T10:00:00Z" },
          { "tag_name": "v0.4.1", "name": "v0.4.1", "html_url": "https://github.com/leandrobattochio/trackarr/releases/tag/v0.4.1", "body": "### Fixed\n- a bug", "draft": false, "prerelease": false, "published_at": "2026-11-20T10:00:00Z" },
          { "tag_name": "v0.3.2", "name": "v0.3.2", "html_url": "https://github.com/leandrobattochio/trackarr/releases/tag/v0.3.2", "body": "old", "draft": false, "prerelease": false, "published_at": "2026-10-01T10:00:00Z" },
          { "tag_name": "nightly", "name": "nightly", "body": "not a version", "draft": false, "prerelease": false },
          { "tag_name": "v9.0.0", "name": "draft", "body": "draft", "draft": true, "prerelease": false }
        ]
        """;

    [Fact]
    public async Task Report_should_list_releases_after_the_last_read_version_up_to_the_installed_one()
    {
        var requests = new List<HttpRequestMessage>();
        var service = CreateService("0.4.1+abc123", request =>
        {
            requests.Add(request);
            return Json(HttpStatusCode.OK, ReleasesJson);
        });

        var report = await service.GetReportAsync("0.4.0");

        report.Status.ShouldBe(AppReleaseStatus.Available);
        report.Error.ShouldBeNull();
        report.InstalledVersion.ShouldBe("0.4.1");
        report.LatestRelease.ShouldNotBeNull();
        report.LatestRelease.Version.ShouldBe("0.5.0");
        report.LatestRelease.TagName.ShouldBe("v0.5.0");
        report.LatestRelease.Url.ShouldBe("https://github.com/leandrobattochio/trackarr/releases/tag/v0.5.0");
        report.UpdateAvailable.ShouldBeTrue();
        report.Releases.Select(release => release.Version).ShouldBe(["0.4.1"]);
        report.Releases[0].Notes.ShouldBe("### Fixed\n- a bug");
        report.Releases[0].PublishedAt.ShouldBe(new DateTimeOffset(2026, 11, 20, 10, 0, 0, TimeSpan.Zero));

        var request = requests.ShouldHaveSingleItem();
        request.RequestUri!.AbsoluteUri.ShouldBe(AppReleaseService.DefaultUrl);
        request.Headers.Authorization.ShouldBeNull();
        request.Headers.UserAgent.ToString().ShouldBe("trackarr/0.4.1");
        request.Headers.Accept.ToString().ShouldBe("application/vnd.github+json");
    }

    [Fact]
    public async Task Report_without_a_last_read_version_should_list_every_release_up_to_the_installed_one()
    {
        var service = CreateService("0.5.0", _ => Json(HttpStatusCode.OK, ReleasesJson));

        var report = await service.GetReportAsync(null);

        report.UpdateAvailable.ShouldBeFalse();
        report.LatestRelease!.Version.ShouldBe("0.5.0");
        report.Releases.Select(release => release.Version).ShouldBe(["0.5.0", "0.4.1", "0.4.0", "0.3.2"]);
    }

    [Fact]
    public async Task Report_should_not_offer_an_update_when_the_installed_version_is_not_semantic()
    {
        var service = CreateService("Unknown", _ => Json(HttpStatusCode.OK, ReleasesJson));

        var report = await service.GetReportAsync("0.4.1");

        report.Status.ShouldBe(AppReleaseStatus.Available);
        report.UpdateAvailable.ShouldBeFalse();
        report.Releases.Select(release => release.Version).ShouldBe(["0.5.0"]);
    }

    [Theory]
    [InlineData(HttpStatusCode.Forbidden, 403)]
    [InlineData(HttpStatusCode.TooManyRequests, 429)]
    public async Task Rate_limit_should_report_unavailable(HttpStatusCode statusCode, int code)
    {
        var service = CreateService("0.4.0", _ => Json(statusCode, """{"message":"API rate limit exceeded"}"""));

        var report = await service.GetReportAsync("0.3.0");

        report.Status.ShouldBe(AppReleaseStatus.Unavailable);
        report.InstalledVersion.ShouldBe("0.4.0");
        report.LatestRelease.ShouldBeNull();
        report.UpdateAvailable.ShouldBeFalse();
        report.Releases.ShouldBeEmpty();
        report.Error.ShouldBe($"The GitHub Releases API rate limit was reached (HTTP {code}). Restart trackarr later to check again.");
    }

    [Fact]
    public async Task No_network_should_report_unavailable()
    {
        var service = CreateService("0.4.0", _ => throw new HttpRequestException("Name or service not known"));

        var report = await service.GetReportAsync(null);

        report.Status.ShouldBe(AppReleaseStatus.Unavailable);
        report.Releases.ShouldBeEmpty();
        report.Error.ShouldBe("Could not reach the GitHub Releases API: Name or service not known");
    }

    [Fact]
    public async Task Timeout_and_malformed_responses_should_report_unavailable()
    {
        var timedOut = CreateService("0.4.0", _ => throw new TaskCanceledException("timeout"));
        (await timedOut.GetReportAsync(null)).Error.ShouldBe("The GitHub Releases API did not answer in time.");

        var malformed = CreateService("0.4.0", _ => Json(HttpStatusCode.OK, """{"releases":[]}"""));
        var report = await malformed.GetReportAsync(null);
        report.Status.ShouldBe(AppReleaseStatus.Unavailable);
        report.Error!.ShouldStartWith("The GitHub Releases API returned an unexpected response:");

        var serverError = CreateService("0.4.0", _ => Json(HttpStatusCode.BadGateway, "{}"));
        (await serverError.GetReportAsync(null)).Error.ShouldBe("The GitHub Releases API returned HTTP 502.");
    }

    [Fact]
    public async Task Releases_should_be_fetched_once_per_process()
    {
        var calls = 0;
        var service = CreateService("0.4.0", _ =>
        {
            Interlocked.Increment(ref calls);
            return Json(HttpStatusCode.TooManyRequests, "{}");
        });

        await service.EnsureCheckedAsync();
        await Task.WhenAll(service.GetReportAsync(null), service.GetReportAsync("0.3.0"));

        calls.ShouldBe(1);
    }

    [Fact]
    public async Task Configured_url_should_replace_the_github_default()
    {
        var requests = new List<Uri>();
        var service = CreateService(
            "0.4.0",
            request =>
            {
                requests.Add(request.RequestUri!);
                return Json(HttpStatusCode.OK, "[]");
            },
            new Dictionary<string, string?> { [AppReleaseService.UrlKey] = "http://releases.example.test/list" });

        var report = await service.GetReportAsync(null);

        report.Status.ShouldBe(AppReleaseStatus.Available);
        report.LatestRelease.ShouldBeNull();
        requests.ShouldHaveSingleItem().AbsoluteUri.ShouldBe("http://releases.example.test/list");
    }

    [Fact]
    public async Task Startup_check_should_fetch_in_the_background()
    {
        var calls = 0;
        var service = CreateService("0.4.0", _ =>
        {
            Interlocked.Increment(ref calls);
            return Json(HttpStatusCode.OK, ReleasesJson);
        });
        using var startup = new AppReleaseStartupCheckService(service);

        await startup.StartAsync(CancellationToken.None);
        await startup.ExecuteTask!;
        await service.GetReportAsync(null);

        calls.ShouldBe(1);
    }

    [Fact]
    public async Task Endpoint_should_return_the_report()
    {
        var controller = new AppReleasesController(CreateService("0.4.0", _ => Json(HttpStatusCode.OK, ReleasesJson)));

        var result = await controller.Get("v0.3.2", CancellationToken.None);

        var json = TestHttp.ToJson(result.ShouldBeOfType<OkObjectResult>().Value);
        json.GetProperty("status").GetString().ShouldBe("available");
        json.GetProperty("installedVersion").GetString().ShouldBe("0.4.0");
        json.GetProperty("updateAvailable").GetBoolean().ShouldBeTrue();
        json.GetProperty("latestRelease").GetProperty("version").GetString().ShouldBe("0.5.0");
        json.GetProperty("error").ValueKind.ShouldBe(JsonValueKind.Null);
        var release = json.GetProperty("releases").EnumerateArray().ShouldHaveSingleItem();
        release.GetProperty("version").GetString().ShouldBe("0.4.0");
        release.GetProperty("tagName").GetString().ShouldBe("v0.4.0");
        release.GetProperty("url").GetString().ShouldBe("https://github.com/leandrobattochio/trackarr/releases/tag/v0.4.0");
        release.GetProperty("notes").GetString().ShouldBe("### Changed\n- plugins come from trackarr-plugins");
    }

    [Fact]
    public async Task Endpoint_should_return_the_unavailable_state()
    {
        var controller = new AppReleasesController(CreateService("0.4.0", _ => Json(HttpStatusCode.Forbidden, "{}")));

        var result = await controller.Get(null, CancellationToken.None);

        var json = TestHttp.ToJson(result.ShouldBeOfType<OkObjectResult>().Value);
        json.GetProperty("status").GetString().ShouldBe("unavailable");
        json.GetProperty("installedVersion").GetString().ShouldBe("0.4.0");
        json.GetProperty("latestRelease").ValueKind.ShouldBe(JsonValueKind.Null);
        json.GetProperty("updateAvailable").GetBoolean().ShouldBeFalse();
        json.GetProperty("releases").GetArrayLength().ShouldBe(0);
        json.GetProperty("error").GetString()!.ShouldContain("HTTP 403");
    }

    [Fact]
    public async Task Endpoint_should_reject_an_invalid_last_read_version()
    {
        var controller = new AppReleasesController(CreateService("0.4.0", _ => Json(HttpStatusCode.OK, "[]")));

        var result = await controller.Get("latest", CancellationToken.None);

        result.ShouldBeOfType<BadRequestObjectResult>();
    }

    private static AppReleaseService CreateService(
        string installedVersion,
        Func<HttpRequestMessage, HttpResponseMessage> responder,
        Dictionary<string, string?>? settings = null)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(settings ?? []).Build();
        return new AppReleaseService(
            configuration,
            new StubHttpClientFactory(new StubHttpMessageHandler(responder)),
            new InstalledAppVersion(installedVersion),
            NullLogger<AppReleaseService>.Instance);
    }

    private static HttpResponseMessage Json(HttpStatusCode statusCode, string json) =>
        new(statusCode) { Content = new StringContent(json, Encoding.UTF8, "application/json") };
}
