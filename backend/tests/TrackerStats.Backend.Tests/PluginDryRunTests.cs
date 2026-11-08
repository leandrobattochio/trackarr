using System.Net;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;
using TrackerStats.Api.Controllers;
using TrackerStats.Domain.Entities;
using TrackerStats.Domain.Plugins;
using TrackerStats.Domain.Plugins.Yaml;
using TrackerStats.Infrastructure.Plugins;
using TrackerStats.Infrastructure.Plugins.Storage;
using TrackerStats.Infrastructure.Plugins.Yaml;
using TrackerStats.Infrastructure.Services;
using TrackerStats.PluginEngine;
using TrackerStats.PluginEngine.Extraction;
using TrackerStats.PluginEngine.Transforms;

namespace TrackerStats.Backend.Tests;

public sealed class PluginDryRunTests : IDisposable
{
    private const string Cookie = "session=SECRET-COOKIE-123456";
    private const string ApiKey = "SECRET-APIKEY+abc123";

    private static readonly string[] Secrets = [Cookie, ApiKey, Uri.EscapeDataString(ApiKey), "SECRET-COOKIE", "SECRET-APIKEY"];

    private static readonly JsonSerializerOptions RawJson = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    private readonly string _root = Path.Combine(Path.GetTempPath(), $"trackerstats-dryrun-{Guid.NewGuid():N}");
    private readonly PluginStorageLayout _layout;
    private readonly YamlPluginDefinitionLoader _loader;
    private readonly InMemoryIntegrationRepository _integrations = new();
    private readonly InMemoryIntegrationSnapshotRepository _snapshots = new();
    private readonly ListLogger<YamlPluginEngine> _engineLogger = new();
    private readonly List<HttpRequestMessage> _requests = [];
    private Func<HttpRequestMessage, HttpResponseMessage> _responder = _ => new HttpResponseMessage(HttpStatusCode.OK);

    public PluginDryRunTests()
    {
        _layout = PluginStorageLayout.ForDataDirectory(_root);
        _loader = new YamlPluginDefinitionLoader(_layout, new FakeApplicationSettingsService());
    }

    public void Dispose()
    {
        if (Directory.Exists(_root))
            Directory.Delete(_root, recursive: true);
    }

    [Fact]
    public async Task S29_a_successful_test_should_report_steps_and_stats_without_touching_the_integration()
    {
        var integration = SeedIntegration("dry-tracker");
        _responder = TrackerResponses();

        var body = await TestOk(new PluginTestRequest(integration.Id, DryTrackerYaml(), false));

        body.GetProperty("outcome").GetString().ShouldBe("success");
        Steps(body).ShouldBe(new[]
        {
            ("profile", "GET", "/profile.php", 200),
            ("stats", "GET", "/api/***/stats", 200)
        });
        var stats = body.GetProperty("stats");
        stats.GetProperty("ratio").GetDecimal().ShouldBe(2.5m);
        stats.GetProperty("uploadedBytes").GetInt64().ShouldBe(2048);
        stats.GetProperty("seedingTorrents").GetInt32().ShouldBe(3);
        stats.GetProperty("activeTorrents").GetInt32().ShouldBe(4);
        body.GetProperty("failedField").ValueKind.ShouldBe(JsonValueKind.Null);
        body.GetProperty("error").ValueKind.ShouldBe(JsonValueKind.Null);

        _requests[0].Headers.GetValues("Cookie").ShouldContain(Cookie);
        _integrations.Updated.ShouldBeEmpty();
        _snapshots.Added.ShouldBeEmpty();
        var stored = _integrations.Find(integration.Id)!;
        stored.LastSyncAt.ShouldBeNull();
        stored.LastSyncResult.ShouldBeNull();
        stored.Ratio.ShouldBeNull();
        AssertNoSecrets(body);
    }

    [Fact]
    public async Task S29_an_auth_failure_should_report_auth_failed_and_log_the_status_without_secrets()
    {
        var integration = SeedIntegration("dry-tracker");
        _responder = _ => new HttpResponseMessage(HttpStatusCode.Unauthorized) { Content = new StringContent("denied") };

        var body = await TestOk(new PluginTestRequest(integration.Id, DryTrackerYaml(), false));

        body.GetProperty("outcome").GetString().ShouldBe("authFailed");
        Steps(body).ShouldBe(new[] { ("profile", "GET", "/profile.php", 401) });
        body.GetProperty("stats").ValueKind.ShouldBe(JsonValueKind.Null);
        body.GetProperty("error").GetString().ShouldBe("Step 'profile' got HTTP 401, which means authentication failed.");
        var log = _engineLogger.Entries.ShouldHaveSingleItem();
        log.Message.ShouldBe("Plugin 'dry-tracker' step 'profile' got HTTP 401 from GET /profile.php.");
        _integrations.Updated.ShouldBeEmpty();
        AssertNoSecrets(body);
    }

    [Fact]
    public async Task S29_an_auth_failure_pattern_in_a_200_response_should_report_auth_failed()
    {
        var integration = SeedIntegration("dry-tracker");
        _responder = _ => Html("<form>Please login</form>");

        var body = await TestOk(new PluginTestRequest(integration.Id, DryTrackerYaml(), false));

        body.GetProperty("outcome").GetString().ShouldBe("authFailed");
        Steps(body).ShouldBe(new[] { ("profile", "GET", "/profile.php", 200) });
        body.GetProperty("error").GetString().ShouldBe("Step 'profile' matched an authentication failure pattern.");
        _engineLogger.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task S29_an_extraction_failure_should_name_the_first_failing_field()
    {
        var integration = SeedIntegration("dry-tracker");
        _responder = TrackerResponses(statsJson: """{"uploaded": "2 KiB"}""");

        var body = await TestOk(new PluginTestRequest(integration.Id, DryTrackerYaml(), false));

        body.GetProperty("outcome").GetString().ShouldBe("unknownError");
        Steps(body).Select(step => step.Status).ShouldBe(new[] { 200, 200 });
        var failed = body.GetProperty("failedField");
        failed.GetProperty("step").GetString().ShouldBe("stats");
        failed.GetProperty("field").GetString().ShouldBe("ratio");
        failed.GetProperty("error").GetString().ShouldBe("Failed to extract 'ratio' from step 'stats' using JSON path 'ratio'.");
        body.GetProperty("stats").ValueKind.ShouldBe(JsonValueKind.Null);
        AssertNoSecrets(body);
    }

    [Fact]
    public async Task S29_a_validation_failure_should_name_the_field_and_use_its_on_fail_outcome()
    {
        var integration = SeedIntegration("dry-tracker");
        _responder = TrackerResponses(profileHtml: "<span>user-</span>");

        var body = await TestOk(new PluginTestRequest(integration.Id, DryTrackerYaml(usernameRegex: "user-(?<username>\\\\w*)"), false));

        body.GetProperty("outcome").GetString().ShouldBe("authFailed");
        var failed = body.GetProperty("failedField");
        failed.GetProperty("step").GetString().ShouldBe("profile");
        failed.GetProperty("field").GetString().ShouldBe("username");
        failed.GetProperty("error").GetString().ShouldBe("Field 'username' in step 'profile' failed validation rule 'notEmpty'.");
    }

    [Fact]
    public async Task S29_a_mapping_failure_should_name_the_mapping_field()
    {
        var integration = SeedIntegration("dry-tracker");
        _responder = TrackerResponses();

        var body = await TestOk(new PluginTestRequest(integration.Id, DryTrackerYaml(ratioMapping: "steps.stats.missing"), false));

        body.GetProperty("outcome").GetString().ShouldBe("unknownError");
        var failed = body.GetProperty("failedField");
        failed.GetProperty("step").ValueKind.ShouldBe(JsonValueKind.Null);
        failed.GetProperty("field").GetString().ShouldBe("mapping.ratio");
        failed.GetProperty("error").GetString().ShouldBe("Unable to resolve mapping operand 'steps.stats.missing'.");
    }

    [Fact]
    public async Task S29_a_non_2xx_response_should_report_every_step_status_and_log_the_path_without_query_or_secrets()
    {
        var integration = SeedIntegration("dry-tracker");
        _responder = request => request.RequestUri!.AbsolutePath.StartsWith("/api/", StringComparison.Ordinal)
            ? new HttpResponseMessage(HttpStatusCode.InternalServerError) { Content = new StringContent($"boom {ApiKey}") }
            : Html(ProfileHtml);

        var body = await TestOk(new PluginTestRequest(integration.Id, DryTrackerYaml(), false));

        body.GetProperty("outcome").GetString().ShouldBe("unknownError");
        Steps(body).ShouldBe(new[]
        {
            ("profile", "GET", "/profile.php", 200),
            ("stats", "GET", "/api/***/stats", 500)
        });
        body.GetProperty("error").GetString().ShouldBe("Step 'stats' got HTTP 500.");
        body.GetProperty("failedField").ValueKind.ShouldBe(JsonValueKind.Null);
        var log = _engineLogger.Entries.ShouldHaveSingleItem();
        log.Message.ShouldBe("Plugin 'dry-tracker' step 'stats' got HTTP 500 from GET /api/***/stats.");
        AssertNoSecrets(body);
    }

    [Fact]
    public async Task S29_test_official_should_run_the_official_file_even_when_an_override_shadows_it()
    {
        WritePlugin(PluginOrigin.Official, "seedpool", File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "plugin-source", "plugins", "seedpool.yaml")));
        WritePlugin(PluginOrigin.Override, "seedpool", "pluginId: seedpool\ndisplayName: Broken override\nsteps: [");
        var integration = SeedIntegration("seedpool", baseUrl: "https://seedpool.org/");
        _responder = _ => Json("""
            {"username":"alice","uploaded":"1 KiB","downloaded":"512 B","ratio":"2","buffer":"1 GiB",
             "seeding":"5","leeching":"0","seedbonus":"10","hit_and_runs":"0"}
            """);

        var body = await TestOk(new PluginTestRequest(integration.Id, null, true));

        body.GetProperty("outcome").GetString().ShouldBe("success");
        Steps(body).ShouldBe(new[] { ("user", "GET", "/api/user", 200) });
        body.GetProperty("stats").GetProperty("uploadedBytes").GetInt64().ShouldBe(1024);
        _requests.ShouldHaveSingleItem().RequestUri!.Query.ShouldContain("api_token=");
        _integrations.Updated.ShouldBeEmpty();
        _snapshots.Added.ShouldBeEmpty();
        AssertNoSecrets(body);
    }

    [Fact]
    public async Task Test_should_report_an_integration_whose_base_url_the_yaml_does_not_allow()
    {
        var integration = SeedIntegration("dry-tracker", baseUrl: "https://elsewhere.test/");

        var body = await TestOk(new PluginTestRequest(integration.Id, DryTrackerYaml(), false));

        body.GetProperty("outcome").GetString().ShouldBe("unknownError");
        body.GetProperty("error").GetString().ShouldNotBeNull()
            .ShouldContain("base URL 'https://elsewhere.test/' is no longer listed by plugin 'dry-tracker'");
        body.GetProperty("steps").GetArrayLength().ShouldBe(0);
        _requests.ShouldBeEmpty();
    }

    [Fact]
    public async Task Test_should_reject_invalid_requests()
    {
        var integration = SeedIntegration("dry-tracker");

        Error((await Test(new PluginTestRequest(null, DryTrackerYaml(), false))).ShouldBeOfType<BadRequestObjectResult>())
            .ShouldBe("integrationId is required.");
        Error((await Test(new PluginTestRequest(integration.Id, DryTrackerYaml(), true))).ShouldBeOfType<BadRequestObjectResult>())
            .ShouldBe("Send either yaml or useOfficial: true.");
        Error((await Test(new PluginTestRequest(integration.Id, " ", false))).ShouldBeOfType<BadRequestObjectResult>())
            .ShouldBe("Send either yaml or useOfficial: true.");
        (await Test(new PluginTestRequest(Guid.NewGuid(), DryTrackerYaml(), false))).ShouldBeOfType<NotFoundObjectResult>();
        Error((await Test(new PluginTestRequest(integration.Id, DryTrackerYaml().Replace("pluginId: dry-tracker", "pluginId: other"), false)))
                .ShouldBeOfType<BadRequestObjectResult>())
            .ShouldBe("The YAML is plugin 'other', but the integration uses plugin 'dry-tracker'.");
        Error((await Test(new PluginTestRequest(integration.Id, "pluginId: [", false))).ShouldBeOfType<BadRequestObjectResult>())
            .ShouldStartWith("Invalid YAML syntax");
        Error((await Test(new PluginTestRequest(integration.Id, null, true))).ShouldBeOfType<NotFoundObjectResult>())
            .ShouldBe("Plugin 'dry-tracker' has no official version installed.");
        _requests.ShouldBeEmpty();
    }

    [Fact]
    public async Task D73_a_normal_sync_should_log_the_status_of_a_non_2xx_step_without_query_or_secrets()
    {
        WritePlugin(PluginOrigin.Custom, "dry-tracker", DryTrackerYaml());
        var integration = SeedIntegration("dry-tracker");
        _responder = request => request.RequestUri!.AbsolutePath.StartsWith("/api/", StringComparison.Ordinal)
            ? new HttpResponseMessage(HttpStatusCode.BadGateway)
            : Html(ProfileHtml);
        var registry = new TrackerPluginRegistry(
            new ServiceCollection().BuildServiceProvider(), CreateEngine(), new TemplateInterpolator(), _loader);
        var sync = new IntegrationSyncService(
            _integrations,
            _snapshots,
            registry,
            CreateHttpClientFactory(),
            new IntegrationConfigurationValidator(registry),
            NullLogger<IntegrationSyncService>.Instance);

        var outcome = await sync.SyncAsync(integration.Id, CancellationToken.None);

        outcome.Result.ShouldBe(PluginProcessResult.UnknownError);
        var log = _engineLogger.Entries.ShouldHaveSingleItem();
        log.Level.ShouldBe(Microsoft.Extensions.Logging.LogLevel.Warning);
        log.Message.ShouldBe("Plugin 'dry-tracker' step 'stats' got HTTP 502 from GET /api/***/stats.");
        AssertNoSecretsIn(log.Message);
    }

    [Fact]
    public void Redactor_should_mask_sensitive_values_and_their_url_escaped_form()
    {
        var definition = new PluginDefinition
        {
            PluginId = "x",
            DisplayName = "X",
            Dashboard = new DashboardConfig(),
            Fields =
            [
                new FieldDefinition { Name = "apiKey", Label = "Key" },
                new FieldDefinition { Name = "secretThing", Label = "S", Sensitive = true },
                new FieldDefinition { Name = "username", Label = "U" }
            ]
        };
        var configuration = new PluginConfiguration(new Dictionary<string, string?>
        {
            ["apiKey"] = "k+y/1234",
            ["secretThing"] = "hidden-value",
            ["username"] = "alice"
        });

        var redactor = PluginSecretRedactor.Create(definition, configuration);

        redactor.Redact("/a/k%2By%2F1234/b hidden-value k+y/1234 alice").ShouldBe("/a/***/b *** *** alice");
    }

    private const string ProfileHtml = "<span>user-alice</span>";

    private Func<HttpRequestMessage, HttpResponseMessage> TrackerResponses(
        string profileHtml = ProfileHtml,
        string statsJson = """{"ratio": "2.5", "uploaded": "2 KiB", "downloaded": "1 KiB", "seeding": "3", "leeching": "1"}""") =>
        request => request.RequestUri!.AbsolutePath.StartsWith("/api/", StringComparison.Ordinal)
            ? Json(statsJson)
            : Html(profileHtml);

    private static HttpResponseMessage Html(string html) =>
        new(HttpStatusCode.OK) { Content = new StringContent(html, Encoding.UTF8, "text/html") };

    private static HttpResponseMessage Json(string json) =>
        new(HttpStatusCode.OK) { Content = new StringContent(json, Encoding.UTF8, "application/json") };

    private static string DryTrackerYaml(
        string usernameRegex = "user-(?<username>\\\\w+)",
        string ratioMapping = "steps.stats.ratio") => $$$"""
        # comments survive a dry run
        pluginId: dry-tracker
        displayName: Dry Tracker
        version: 1.0.0
        schemaVersion: 1
        baseUrls:
          - https://tracker.test/
        fields:
          - name: cookie
            label: Cookie
            type: text
            required: true
            sensitive: true
          - name: apiKey
            label: API key
            type: password
            required: true
            sensitive: true
        http:
          headers:
            Cookie: "{{cookie}}"
        authFailure:
          htmlPatterns:
            - Please login
        steps:
          - name: profile
            method: GET
            url: "profile.php?token={{apiKey}}"
            responseType: html
            extract:
              username:
                regex: "{{{usernameRegex}}}"
            validate:
              - field: username
                rule: notEmpty
                onFail: authFailed
          - name: stats
            method: GET
            url: "api/{{apiKey}}/stats?token={{apiKey}}"
            responseType: json
            extract:
              ratio:
                path: ratio
                transform: decimal
              uploaded:
                path: uploaded
                transform: byteSize
              downloaded:
                path: downloaded
                transform: byteSize
              seeding:
                path: seeding
                transform: integer
              leeching:
                path: leeching
                transform: integer
        mapping:
          ratio: "{{{ratioMapping}}}"
          uploadedBytes: steps.stats.uploaded
          downloadedBytes: steps.stats.downloaded
          requiredRatio: fields.required_ratio
          seedingTorrents: steps.stats.seeding
          leechingTorrents: steps.stats.leeching
          activeTorrents: "steps.stats.seeding + steps.stats.leeching"
        dashboard:
          metrics:
            - stat: ratio
              label: Ratio
              format: text
        """;

    private Integration SeedIntegration(string pluginId, string baseUrl = "https://tracker.test/")
    {
        var payload = JsonSerializer.Serialize(new Dictionary<string, string>
        {
            ["baseUrl"] = baseUrl,
            ["cookie"] = Cookie,
            ["apiKey"] = ApiKey,
            ["required_ratio"] = "1.0",
            ["cron"] = "0 * * * *"
        });
        var integration = new Integration { Id = Guid.NewGuid(), PluginId = pluginId, Payload = payload };
        _integrations.Seed(integration);
        return integration;
    }

    private void WritePlugin(PluginOrigin origin, string pluginId, string yaml)
    {
        var path = _layout.GetPluginPath(origin, pluginId);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, yaml);
    }

    private YamlPluginEngine CreateEngine() =>
        new(
            _engineLogger,
            [new CountMatchesExtractionStrategy(), new JsonPathExtractionStrategy(), new RegexExtractionStrategy()],
            [new ByteSizeTransformStrategy(), new DecimalTransformStrategy(), new IntegerTransformStrategy(), new ToStringTransformStrategy()],
            new TemplateInterpolator(),
            new AuthFailureDetector(),
            new ResultMapper());

    private TrackerPluginHttpClientFactory CreateHttpClientFactory() =>
        new(new StubHttpClientFactory(new StubHttpMessageHandler(request =>
        {
            _requests.Add(request);
            return _responder(request);
        })));

    private Task<IActionResult> Test(PluginTestRequest request)
    {
        var engine = CreateEngine();
        var dryRun = new PluginDryRunService(
            _loader, new FakeApplicationSettingsService(), engine, new TemplateInterpolator(), CreateHttpClientFactory());
        return new PluginTestController(_integrations, dryRun).Test(request, CancellationToken.None);
    }

    private async Task<JsonElement> TestOk(PluginTestRequest request) =>
        JsonSerializer.SerializeToElement((await Test(request)).ShouldBeOfType<OkObjectResult>().Value, RawJson);

    private static List<(string Name, string Method, string Path, int Status)> Steps(JsonElement body) =>
        body.GetProperty("steps").EnumerateArray()
            .Select(step => (
                step.GetProperty("name").GetString()!,
                step.GetProperty("method").GetString()!,
                step.GetProperty("path").GetString()!,
                step.GetProperty("statusCode").GetInt32()))
            .ToList();

    private void AssertNoSecrets(JsonElement body)
    {
        AssertNoSecretsIn(body.GetRawText());
        foreach (var entry in _engineLogger.Entries)
            AssertNoSecretsIn(entry.Message);
    }

    private static void AssertNoSecretsIn(string text)
    {
        foreach (var secret in Secrets)
            text.ShouldNotContain(secret);
        text.ShouldNotContain("token=");
    }

    private static string? Error(ObjectResult result) =>
        TestHttp.ToJson(result.Value).GetProperty("error").GetString();
}
