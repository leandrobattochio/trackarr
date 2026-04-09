using System.Net;
using System.Text;
using Shouldly;
using TrackerStats.Infrastructure.Services;

namespace TrackerStats.Backend.Tests;

public sealed class GitHubUpdateCheckServiceTests
{
    [Fact]
    public async Task CheckAsync_should_return_disabled_snapshot_when_setting_is_off()
    {
        var factory = new StubHttpClientFactory(_ => throw new InvalidOperationException("HTTP should not be called."));
        var sut = new GitHubUpdateCheckService(factory, new FakeApplicationSettingsService(checkForUpdates: false));

        var result = await sut.CheckAsync("v0.3.1", CancellationToken.None);

        result.Enabled.ShouldBeFalse();
        result.CurrentVersion.ShouldBe("0.3.1");
        result.LatestVersion.ShouldBeNull();
        factory.RequestCount.ShouldBe(0);
    }

    [Fact]
    public async Task CheckAsync_should_query_github_release_and_report_newer_version()
    {
        var factory = new StubHttpClientFactory(request =>
        {
            request.RequestUri!.PathAndQuery.ShouldBe("/repos/leandrobattochio/trackarr/releases/latest");
            return Json("""{"tag_name":"v0.3.2","html_url":"https://github.com/leandrobattochio/trackarr/releases/tag/v0.3.2"}""");
        });
        var sut = new GitHubUpdateCheckService(factory, new FakeApplicationSettingsService(checkForUpdates: true));

        var result = await sut.CheckAsync("0.3.1", CancellationToken.None);
        var cachedResult = await sut.CheckAsync("0.3.1", CancellationToken.None);

        result.Enabled.ShouldBeTrue();
        result.CurrentVersion.ShouldBe("0.3.1");
        result.LatestVersion.ShouldBe("0.3.2");
        result.ReleaseUrl.ShouldBe("https://github.com/leandrobattochio/trackarr/releases/tag/v0.3.2");
        result.UpdateAvailable.ShouldBeTrue();
        result.Error.ShouldBeNull();
        cachedResult.LatestVersion.ShouldBe("0.3.2");
        factory.RequestCount.ShouldBe(1);
    }

    [Fact]
    public async Task CheckAsync_should_not_report_update_when_versions_match_or_are_unparseable()
    {
        var factory = new StubHttpClientFactory(_ => Json("""{"tag_name":"v0.3.1","html_url":"https://github.test/release"}"""));
        var sut = new GitHubUpdateCheckService(factory, new FakeApplicationSettingsService(checkForUpdates: true));

        var result = await sut.CheckAsync("v0.3.1", CancellationToken.None);

        result.UpdateAvailable.ShouldBeFalse();

        var unparseable = await new GitHubUpdateCheckService(
            new StubHttpClientFactory(_ => Json("""{"tag_name":"nightly","html_url":"https://github.test/release"}""")),
            new FakeApplicationSettingsService(checkForUpdates: true)).CheckAsync("dev", CancellationToken.None);

        unparseable.UpdateAvailable.ShouldBeFalse();
        unparseable.LatestVersion.ShouldBe("nightly");
    }

    [Fact]
    public async Task CheckAsync_should_fail_quietly_when_github_request_fails()
    {
        var sut = new GitHubUpdateCheckService(
            new StubHttpClientFactory(_ => new HttpResponseMessage(HttpStatusCode.InternalServerError)),
            new FakeApplicationSettingsService(checkForUpdates: true));

        var result = await sut.CheckAsync("0.3.1", CancellationToken.None);

        result.Enabled.ShouldBeTrue();
        result.UpdateAvailable.ShouldBeFalse();
        result.Error.ShouldNotBeNull();
    }

    private static HttpResponseMessage Json(string content) =>
        new(HttpStatusCode.OK)
        {
            Content = new StringContent(content, Encoding.UTF8, "application/json")
        };

    private sealed class StubHttpClientFactory(Func<HttpRequestMessage, HttpResponseMessage> responder) : IHttpClientFactory
    {
        public int RequestCount { get; private set; }

        public HttpClient CreateClient(string name)
        {
            name.ShouldBe("github-releases");
            return new HttpClient(new StubHttpMessageHandler(request =>
            {
                RequestCount++;
                return responder(request);
            }))
            {
                BaseAddress = new Uri("https://api.github.com")
            };
        }
    }

    private sealed class StubHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> responder) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(responder(request));
    }
}
