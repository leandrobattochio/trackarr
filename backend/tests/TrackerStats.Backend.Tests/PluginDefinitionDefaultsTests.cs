using Shouldly;
using TrackerStats.Domain.Plugins;
using TrackerStats.Domain.Plugins.Yaml;

namespace TrackerStats.Backend.Tests;

public class PluginDefinitionDefaultsTests
{
    [Fact]
    public void GetReservedPropertyViolation_should_detect_engine_owned_http_and_auth_settings()
    {
        var definition = new PluginDefinition
        {
            PluginId = "plugin",
            DisplayName = "Plugin",
            BaseUrls = ["https://tracker.test/"],
            Fields = [],
            CustomFields = [],
            Steps = [new StepDefinition { Name = "profile", Method = "GET", Url = "/", ResponseType = "html" }],
            Dashboard = new DashboardConfig { Metrics = [new DashboardMetricDefinition { Stat = "ratio", Label = "Ratio", Format = "text" }] },
            Http = new HttpConfig
            {
                BaseUrl = "https://tracker.test",
                Headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    ["User-Agent"] = "custom"
                }
            },
            AuthFailure = new AuthFailureConfig
            {
                HttpStatusCodes = [418]
            }
        };

        PluginDefinitionDefaults.GetReservedPropertyViolation(definition)
            .ShouldBe("Property 'http.baseUrl' is engine-owned and must not be declared in plugin YAML.");

        definition.Http.BaseUrl = null;
        PluginDefinitionDefaults.GetReservedPropertyViolation(definition)
            .ShouldBe("Header 'http.headers.User-Agent' is engine-owned and must not be declared in plugin YAML.");

        definition.Http.Headers.Clear();
        PluginDefinitionDefaults.GetReservedPropertyViolation(definition)
            .ShouldBe("Property 'authFailure.httpStatusCodes' is engine-owned and must not be declared in plugin YAML.");
    }

    [Fact]
    public void ApplyDefaults_should_preserve_existing_values_and_fill_missing_defaults()
    {
        var definition = new PluginDefinition
        {
            PluginId = "plugin",
            DisplayName = "Plugin",
            BaseUrls = ["https://tracker.test/"],
            Fields =
            [
                new FieldDefinition { Name = "custom", Label = "Custom", Type = "text" }
            ],
            CustomFields = [],
            Http = new HttpConfig
            {
                BaseUrl = "https://tracker.test",
                Headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    ["X-Test"] = "1",
                    ["User-Agent"] = "custom-agent"
                }
            },
            AuthFailure = new AuthFailureConfig
            {
                HtmlPatterns = ["login"],
                HttpStatusCodes = [401]
            },
            Steps = [new StepDefinition { Name = "profile", Method = "GET", Url = "/", ResponseType = "html" }],
            Dashboard = new DashboardConfig { Metrics = [new DashboardMetricDefinition { Stat = "ratio", Label = "Ratio", Format = "text" }] }
        };

        PluginDefinitionDefaults.ApplyDefaults(definition, "test-user-agent");

        definition.BaseUrls.ShouldBe(["https://tracker.test/"]);
        definition.Fields.ShouldContain(field => field.Name == "cron");
        definition.Fields.ShouldContain(field => field.Name == "required_ratio");
        definition.Http.BaseUrl.ShouldBe("https://tracker.test");
        definition.Http.Headers["User-Agent"].ShouldBe("custom-agent");
        definition.AuthFailure.HttpStatusCodes.ShouldBe([401]);
    }
}
