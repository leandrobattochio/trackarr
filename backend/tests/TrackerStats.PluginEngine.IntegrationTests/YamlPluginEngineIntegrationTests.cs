using System.Net;
using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;
using TrackerStats.Domain.Plugins;
using TrackerStats.Domain.Plugins.Yaml;
using TrackerStats.PluginEngine;
using TrackerStats.PluginEngine.Extraction;
using TrackerStats.PluginEngine.Transforms;

namespace TrackerStats.PluginEngine.IntegrationTests;

public class YamlPluginEngineIntegrationTests
{
    [Fact]
    public async Task ExecuteAsync_should_process_multi_step_plugin_definition_end_to_end()
    {
        var requests = new List<Uri>();
        using var httpClient = new HttpClient(new StubHttpMessageHandler(request =>
        {
            requests.Add(request.RequestUri!);

            if (request.RequestUri!.AbsolutePath == "/login")
            {
                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent("<input name=\"token\" value=\"abc-123\" />")
                };
            }

            request.RequestUri!.ToString().ShouldBe("https://tracker.test/api/stats?token=abc-123&user=alice");

            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("""
                    {
                      "metrics": {
                        "ratio": "1,75",
                        "uploaded": "1.5 GiB",
                        "downloaded": "750 MiB",
                        "seeding": "8",
                        "leeching": "2",
                        "bonus": "42",
                        "hnr": "1"
                      }
                    }
                    """)
            };
        }))
        {
            BaseAddress = new Uri("https://tracker.test")
        };

        var sut = CreateSut();
        var definition = TestData.CreatePluginDefinition(
            steps:
            [
                new StepDefinition
                {
                    Name = "login",
                    Url = "https://tracker.test/login",
                    Extract = new Dictionary<string, ExtractionRule>
                    {
                        ["token"] = new() { Regex = "value=\"(?<token>[^\"]+)\"" }
                    }
                },
                new StepDefinition
                {
                    Name = "stats",
                    Url = "https://tracker.test/api/stats?token={{steps.login.token}}&user={{fields.username}}",
                    ResponseType = "json",
                    Extract = new Dictionary<string, ExtractionRule>
                    {
                        ["ratio"] = new() { Path = "metrics.ratio", Transform = "decimal" },
                        ["uploaded"] = new() { Path = "metrics.uploaded", Transform = "bytesize" },
                        ["downloaded"] = new() { Path = "metrics.downloaded", Transform = "bytesize" },
                        ["seeding"] = new() { Path = "metrics.seeding", Transform = "integer" },
                        ["leeching"] = new() { Path = "metrics.leeching", Transform = "integer" },
                        ["bonus"] = new() { Path = "metrics.bonus", Transform = "tostring" },
                        ["hnr"] = new() { Path = "metrics.hnr", Transform = "integer" }
                    }
                }
            ]);
        var configuration = new PluginConfiguration(new Dictionary<string, string?>
        {
            ["username"] = "alice",
            ["requiredRatio"] = "1.00",
            ["bufferLabel"] = "safe"
        });

        var result = await sut.ExecuteAsync(definition, configuration, httpClient, CancellationToken.None);

        requests.Count.ShouldBe(2);
        result.Result.ShouldBe(PluginProcessResult.Success);
        result.Stats.ShouldNotBeNull();
        result.Stats.Ratio.ShouldBe(1.75m);
        result.Stats.UploadedBytes.ShouldBe(1610612736L);
        result.Stats.DownloadedBytes.ShouldBe(786432000L);
        result.Stats.SeedingTorrents.ShouldBe(8);
        result.Stats.LeechingTorrents.ShouldBe(2);
        result.Stats.ActiveTorrents.ShouldBe(10);
        result.Stats.HitAndRuns.ShouldBe(1);
        result.Stats.SeedBonus.ShouldBe("42");
        result.Stats.Buffer.ShouldBe("safe");
    }

    [Fact]
    public async Task ExecuteAsync_should_return_auth_failed_when_validation_rule_fails_with_auth_failed()
    {
        using var httpClient = new HttpClient(new StubHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("<input name=\"token\" value=\"\" />")
            }));

        var sut = CreateSut();
        var definition = TestData.CreatePluginDefinition(
            steps:
            [
                new StepDefinition
                {
                    Name = "login",
                    Url = "https://tracker.test/login",
                    Extract = new Dictionary<string, ExtractionRule>
                    {
                        ["token"] = new() { Regex = "value=\"(?<token>[^\"]*)\"" }
                    },
                    Validate =
                    [
                        new ValidationRule
                        {
                            Field = "token",
                            Rule = "notEmpty",
                            OnFail = "authFailed"
                        }
                    ]
                }
            ]);
        var configuration = new PluginConfiguration(new Dictionary<string, string?>
        {
            ["requiredRatio"] = "1.00",
            ["bufferLabel"] = "safe"
        });

        var result = await sut.ExecuteAsync(definition, configuration, httpClient, CancellationToken.None);

        result.Result.ShouldBe(PluginProcessResult.AuthFailed);
        result.Stats.ShouldBeNull();
    }

    [Fact]
    public async Task ExecuteAsync_should_return_auth_failed_when_custom_auth_failure_matches_response()
    {
        using var httpClient = new HttpClient(new StubHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("<html>Please sign in to continue</html>")
            }));

        var sut = CreateSut();
        var definition = TestData.CreatePluginDefinition(
            steps:
            [
                new StepDefinition
                {
                    Name = "stats",
                    Url = "https://tracker.test/stats"
                }
            ]);
        definition.AuthFailure = new AuthFailureConfig
        {
            HtmlPatterns = ["sign in to continue"]
        };

        var result = await sut.ExecuteAsync(
            definition,
            new PluginConfiguration(new Dictionary<string, string?>
            {
                ["requiredRatio"] = "1.00",
                ["bufferLabel"] = "safe"
            }),
            httpClient,
            CancellationToken.None);

        result.Result.ShouldBe(PluginProcessResult.AuthFailed);
    }

    [Fact]
    public async Task ExecuteAsync_should_return_unknown_error_for_unsuccessful_non_auth_response()
    {
        using var httpClient = new HttpClient(new StubHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.InternalServerError)
            {
                Content = new StringContent("server error")
            }));

        var sut = CreateSut();
        var definition = TestData.CreatePluginDefinition(
            steps:
            [
                new StepDefinition
                {
                    Name = "stats",
                    Url = "https://tracker.test/stats"
                }
            ]);
        var configuration = new PluginConfiguration(new Dictionary<string, string?>
        {
            ["requiredRatio"] = "1.00",
            ["bufferLabel"] = "safe"
        });

        var result = await sut.ExecuteAsync(definition, configuration, httpClient, CancellationToken.None);

        result.Result.ShouldBe(PluginProcessResult.UnknownError);
        result.Stats.ShouldBeNull();
    }

    [Fact]
    public async Task ExecuteAsync_should_return_unknown_error_for_unsupported_http_method()
    {
        using var httpClient = new HttpClient(new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)));
        var sut = CreateSut();
        var definition = TestData.CreatePluginDefinition(
            steps:
            [
                new StepDefinition
                {
                    Name = "stats",
                    Method = "PATCH",
                    Url = "https://tracker.test/stats"
                }
            ]);

        var result = await sut.ExecuteAsync(definition, CreateConfiguration(), httpClient, CancellationToken.None);

        result.Result.ShouldBe(PluginProcessResult.UnknownError);
    }

    [Fact]
    public async Task ExecuteAsync_should_return_unknown_error_for_invalid_plugin_definition()
    {
        using var httpClient = new HttpClient(new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)));
        var sut = CreateSut();
        var definition = TestData.CreatePluginDefinition();
        definition.PluginId = "";

        var result = await sut.ExecuteAsync(definition, CreateConfiguration(), httpClient, CancellationToken.None);

        result.Result.ShouldBe(PluginProcessResult.UnknownError);
    }

    [Fact]
    public async Task ExecuteAsync_should_return_unknown_error_for_missing_extract_rule_strategy()
    {
        using var httpClient = new HttpClient(new StubHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{}") }));
        var sut = CreateSut();
        var definition = TestData.CreatePluginDefinition(
            steps:
            [
                new StepDefinition
                {
                    Name = "stats",
                    Url = "https://tracker.test/stats",
                    ResponseType = "json",
                    Extract = new Dictionary<string, ExtractionRule>
                    {
                        ["ratio"] = new()
                    }
                }
            ]);

        var result = await sut.ExecuteAsync(definition, CreateConfiguration(), httpClient, CancellationToken.None);

        result.Result.ShouldBe(PluginProcessResult.UnknownError);
    }

    [Fact]
    public async Task ExecuteAsync_should_return_unknown_error_for_unsupported_transform()
    {
        using var httpClient = new HttpClient(new StubHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("""{"value":"1"}""")
            }));
        var sut = CreateSut();
        var definition = TestData.CreatePluginDefinition(
            steps:
            [
                new StepDefinition
                {
                    Name = "stats",
                    Url = "https://tracker.test/stats",
                    ResponseType = "json",
                    Extract = new Dictionary<string, ExtractionRule>
                    {
                        ["ratio"] = new() { Path = "value", Transform = "mystery" },
                        ["uploaded"] = new() { Path = "value" },
                        ["downloaded"] = new() { Path = "value" },
                        ["seeding"] = new() { Path = "value" },
                        ["leeching"] = new() { Path = "value" }
                    }
                }
            ]);

        var result = await sut.ExecuteAsync(definition, CreateConfiguration(), httpClient, CancellationToken.None);

        result.Result.ShouldBe(PluginProcessResult.UnknownError);
    }

    [Fact]
    public async Task ExecuteAsync_should_return_unknown_error_for_not_empty_validation_failure()
    {
        using var httpClient = new HttpClient(new StubHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("""{"value":""}""")
            }));
        var sut = CreateSut();
        var definition = TestData.CreatePluginDefinition(
            steps:
            [
                new StepDefinition
                {
                    Name = "stats",
                    Url = "https://tracker.test/stats",
                    ResponseType = "json",
                    Extract = new Dictionary<string, ExtractionRule>
                    {
                        ["ratio"] = new() { Path = "value" },
                        ["uploaded"] = new() { Path = "value" },
                        ["downloaded"] = new() { Path = "value" },
                        ["seeding"] = new() { Path = "value" },
                        ["leeching"] = new() { Path = "value" }
                    },
                    Validate =
                    [
                        new ValidationRule
                        {
                            Field = "ratio",
                            Rule = "notEmpty",
                            OnFail = "unknownError"
                        }
                    ]
                }
            ]);

        var result = await sut.ExecuteAsync(definition, CreateConfiguration(), httpClient, CancellationToken.None);

        result.Result.ShouldBe(PluginProcessResult.UnknownError);
    }

    private static YamlPluginEngine CreateSut()
    {
        return new YamlPluginEngine(
            NullLogger<YamlPluginEngine>.Instance,
            [new CountMatchesExtractionStrategy(), new JsonPathExtractionStrategy(), new RegexExtractionStrategy()],
            [new ByteSizeTransformStrategy(), new DecimalTransformStrategy(), new IntegerTransformStrategy(), new ToStringTransformStrategy()],
            new TemplateInterpolator(),
            new AuthFailureDetector(),
            new ResultMapper());
    }

    private static PluginConfiguration CreateConfiguration() => new(new Dictionary<string, string?>
    {
        ["username"] = "alice",
        ["requiredRatio"] = "1.00",
        ["bufferLabel"] = "safe"
    });
}
