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
            Fields =
            [
                new FieldDefinition { Name = "custom", Label = "Custom", Type = "text" },
                new FieldDefinition { Name = "baseUrl", Label = "Base URL", Type = "text" }
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

        PluginDefinitionDefaults.ApplyDefaults(definition);

        definition.Fields.Count(field => string.Equals(field.Name, "baseUrl", StringComparison.OrdinalIgnoreCase)).ShouldBe(1);
        definition.Fields.ShouldContain(field => field.Name == "cron");
        definition.Fields.ShouldContain(field => field.Name == "required_ratio");
        definition.Http.BaseUrl.ShouldBe("https://tracker.test");
        definition.Http.Headers["User-Agent"].ShouldBe("custom-agent");
        definition.AuthFailure.HttpStatusCodes.ShouldBe([401]);
    }

    [Fact]
    public void CreateEditableDefinition_should_remove_engine_owned_values_and_keep_user_defined_settings()
    {
        var definition = new PluginDefinition
        {
            PluginId = "plugin",
            DisplayName = "Plugin",
            Fields =
            [
                new FieldDefinition { Name = "cron", Label = "Cron", Type = "cron" },
                new FieldDefinition { Name = "custom", Label = "Custom", Type = "text" }
            ],
            CustomFields =
            [
                new FieldDefinition { Name = "token", Label = "Token", Type = "text", Sensitive = true }
            ],
            Http = new HttpConfig
            {
                BaseUrl = "{{baseUrl}}",
                Headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    ["User-Agent"] = "custom-agent",
                    ["X-Test"] = "1"
                },
                Cookies = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    ["cookie"] = "value"
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

        var editable = PluginDefinitionDefaults.CreateEditableDefinition(definition);

        editable.Fields.Select(f => f.Name).ShouldBe(["custom"]);
        editable.CustomFields.Select(f => f.Name).ShouldBe(["token"]);
        editable.Http.ShouldNotBeNull();
        editable.Http.BaseUrl.ShouldBeNull();
        editable.Http.Headers.ContainsKey("User-Agent").ShouldBeFalse();
        editable.Http.Headers["X-Test"].ShouldBe("1");
        editable.AuthFailure.ShouldNotBeNull();
        editable.AuthFailure.HttpStatusCodes.ShouldBeEmpty();
        editable.AuthFailure.HtmlPatterns.ShouldBe(["login"]);
    }

    [Fact]
    public void CreateEditableDefinition_should_return_null_http_and_auth_when_they_only_contain_engine_defaults()
    {
        var definition = new PluginDefinition
        {
            PluginId = "plugin",
            DisplayName = "Plugin",
            Fields = [],
            CustomFields = [],
            Http = new HttpConfig
            {
                BaseUrl = "",
                Headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    ["User-Agent"] = "agent"
                }
            },
            AuthFailure = new AuthFailureConfig(),
            Steps = [new StepDefinition { Name = "profile", Method = "GET", Url = "/", ResponseType = "html" }],
            Dashboard = new DashboardConfig { Metrics = [new DashboardMetricDefinition { Stat = "ratio", Label = "Ratio", Format = "text" }] }
        };

        var editable = PluginDefinitionDefaults.CreateEditableDefinition(definition);

        editable.Http.ShouldBeNull();
        editable.AuthFailure.ShouldBeNull();
    }
}
