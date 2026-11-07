using System.Net;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;
using TrackerStats.Domain.Plugins;
using TrackerStats.Domain.Plugins.Yaml;
using TrackerStats.Infrastructure.Plugins.Yaml;
using TrackerStats.PluginEngine.Extraction;
using TrackerStats.PluginEngine.Transforms;

namespace TrackerStats.PluginEngine.IntegrationTests;

public class AscPluginIntegrationTests
{
    private const string DashboardPage = """
        <!DOCTYPE html><html><body>
        <script data-page="app" type="application/json">{"component":"dashboard","props":{"auth":{"user":{"id":1,"name":"alice"},"stats":{"uploaded":2000000000000,"downloaded":500000000000,"ratio":4.2500000000000004,"seedBonus":250,"reputation":10.5,"vipTier":{"name":"gold"},"hitAndRuns":0,"seeding":3,"leeching":2,"connectivity":null}},"news":[{"title":"Faça Login de novo"}]}}</script>
        </body></html>
        """;

    private const string GuestPage = """
        <!DOCTYPE html><html><body>
        <script data-page="app" type="application/json">{"component":"auth\/login","props":{"auth":{"user":null}}}</script>
        </body></html>
        """;

    [Fact]
    public async Task ExecuteAsync_should_read_stats_from_the_dashboard_page()
    {
        Uri? requested = null;

        var result = await ExecuteAsync(request =>
        {
            requested = request.RequestUri;
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(DashboardPage) };
        });

        requested.ShouldBe(new Uri("https://amigos-share.club/dashboard"));
        result.Result.ShouldBe(PluginProcessResult.Success);
        result.Stats.ShouldNotBeNull();
        result.Stats.Ratio.ShouldBe(4.25m);
        result.Stats.UploadedBytes.ShouldBe(2000000000000);
        result.Stats.DownloadedBytes.ShouldBe(500000000000);
        result.Stats.SeedBonus.ShouldBe("250");
        result.Stats.SeedingTorrents.ShouldBe(3);
        result.Stats.LeechingTorrents.ShouldBe(2);
        result.Stats.ActiveTorrents.ShouldBe(5);
    }

    [Fact]
    public async Task ExecuteAsync_should_report_auth_failure_when_redirected_to_the_guest_login_page()
    {
        var result = await ExecuteAsync(_ =>
            new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(GuestPage) });

        result.Result.ShouldBe(PluginProcessResult.AuthFailed);
    }

    [Fact]
    public async Task ExecuteAsync_should_report_auth_failure_on_unauthorized_response()
    {
        var result = await ExecuteAsync(_ =>
            new HttpResponseMessage(HttpStatusCode.Unauthorized) { Content = new StringContent("""{"message":"Unauthenticated."}""") });

        result.Result.ShouldBe(PluginProcessResult.AuthFailed);
    }

    private static async Task<TrackerFetchResult> ExecuteAsync(Func<HttpRequestMessage, HttpResponseMessage> responder)
    {
        var definition = LoadDefinition();
        using var httpClient = new HttpClient(new StubHttpMessageHandler(responder))
        {
            BaseAddress = new Uri(definition.BaseUrls.Single())
        };
        var sut = new YamlPluginEngine(
            NullLogger<YamlPluginEngine>.Instance,
            [new CountMatchesExtractionStrategy(), new JsonPathExtractionStrategy(), new RegexExtractionStrategy()],
            [new ByteSizeTransformStrategy(), new DecimalTransformStrategy(), new IntegerTransformStrategy(), new ToStringTransformStrategy()],
            new TemplateInterpolator(),
            new AuthFailureDetector(),
            new ResultMapper());
        var configuration = new PluginConfiguration(new Dictionary<string, string?>
        {
            ["cookie"] = "session=test",
            ["required_ratio"] = "1"
        });

        return await sut.ExecuteAsync(definition, configuration, httpClient, CancellationToken.None);
    }

    private static PluginDefinition LoadDefinition()
    {
        var pluginsDirectory = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "plugins"));
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Plugins:Directory"] = pluginsDirectory })
            .Build();

        return new YamlPluginDefinitionLoader(configuration, new FakeApplicationSettingsService())
            .LoadDefinitions()
            .Single(definition => definition.PluginId == "asc")
            .Definition!;
    }
}
