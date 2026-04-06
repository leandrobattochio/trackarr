using System.Net;
using Shouldly;
using TrackerStats.Domain.Plugins;
using TrackerStats.Domain.Plugins.Yaml;
using TrackerStats.PluginEngine;

namespace TrackerStats.PluginEngine.Tests;

public class AuthFailureDetectorTests
{
    private readonly AuthFailureDetector _sut = new();

    [Fact]
    public void Detect_should_treat_unauthorized_status_as_auth_failure_when_no_custom_config_exists()
    {
        using var response = new HttpResponseMessage(HttpStatusCode.Unauthorized);

        var result = _sut.Detect(response, "ignored", authFailure: null);

        result.ShouldNotBeNull();
        result.Result.ShouldBe(PluginProcessResult.AuthFailed);
    }

    [Fact]
    public void Detect_should_treat_matching_html_pattern_as_auth_failure()
    {
        using var response = new HttpResponseMessage(HttpStatusCode.OK);
        var authFailure = new AuthFailureConfig
        {
            HtmlPatterns = ["sign in to continue"]
        };

        var result = _sut.Detect(response, "<html>Sign in to continue</html>", authFailure);

        result.ShouldNotBeNull();
        result.Result.ShouldBe(PluginProcessResult.AuthFailed);
    }
}
