using Shouldly;
using TrackerStats.Domain.Entities;
using TrackerStats.Domain.Plugins;
using TrackerStats.Infrastructure.Services;

namespace TrackerStats.Backend.Tests;

public class IntegrationConfigurationValidatorTests
{
    [Fact]
    public void Validate_should_fail_when_plugin_is_missing()
    {
        var registry = new FakeTrackerPluginRegistry();
        var sut = new IntegrationConfigurationValidator(registry);

        var result = sut.Validate("missing", """{"required_ratio":"1.0"}""");

        result.IsValid.ShouldBeFalse();
        result.Error.ShouldBe("Plugin 'missing' not found.");
    }

    [Fact]
    public void Validate_should_fail_when_payload_is_invalid_json()
    {
        var registry = new FakeTrackerPluginRegistry();
        registry.Register(new FakeTrackerPlugin("plugin"));
        var sut = new IntegrationConfigurationValidator(registry);

        var result = sut.Validate("plugin", "{ not json");

        result.IsValid.ShouldBeFalse();
        result.Error.ShouldBe("Payload is not valid JSON.");
    }

    [Fact]
    public void Validate_should_fail_when_required_fields_are_missing()
    {
        var registry = new FakeTrackerPluginRegistry();
        registry.Register(new FakeTrackerPlugin("plugin",
        [
            new PluginField("required_ratio", "Required Ratio", null, "number", true, false),
            new PluginField("username", "Username", null, "text", true, false)
        ]));
        var sut = new IntegrationConfigurationValidator(registry);

        var result = sut.Validate("plugin", """{"required_ratio":"1.0"}""");

        result.IsValid.ShouldBeFalse();
        result.Error.ShouldBe("Integration is missing required fields: username.");
    }

    [Fact]
    public void Validate_should_fail_when_number_field_is_not_decimal()
    {
        var registry = new FakeTrackerPluginRegistry();
        registry.Register(new FakeTrackerPlugin("plugin",
        [
            new PluginField("required_ratio", "Required Ratio", null, "number", true, false)
        ]));
        var sut = new IntegrationConfigurationValidator(registry);

        var result = sut.Validate("plugin", """{"required_ratio":"nope"}""");

        result.IsValid.ShouldBeFalse();
        result.Error.ShouldBe("Field 'required_ratio' must be a valid decimal number.");
    }

    [Fact]
    public void Validate_should_fail_when_cron_field_is_invalid()
    {
        var registry = new FakeTrackerPluginRegistry();
        registry.Register(new FakeTrackerPlugin("plugin",
        [
            new PluginField("required_ratio", "Required Ratio", null, "number", true, false),
            new PluginField("cron", "Cron", null, "cron", true, false)
        ]));
        var sut = new IntegrationConfigurationValidator(registry);

        var result = sut.Validate("plugin", """{"required_ratio":"1.0","cron":"* * *"}""");

        result.IsValid.ShouldBeFalse();
        result.Error.ShouldBe("Field 'cron' must be a valid 5-part UTC cron expression.");
    }

    [Fact]
    public void Validate_should_fail_when_base_url_is_not_in_plugin_options()
    {
        var registry = new FakeTrackerPluginRegistry();
        registry.Register(new FakeTrackerPlugin("plugin",
        [
            new PluginField("required_ratio", "Required Ratio", null, "number", true, false)
        ],
        ["https://tracker.test/"]));
        var sut = new IntegrationConfigurationValidator(registry);

        var result = sut.Validate("plugin", """{"baseUrl":"https://other.test/","required_ratio":"1.0"}""");

        result.IsValid.ShouldBeFalse();
        result.Error.ShouldBe("Field 'baseUrl' must match one of the plugin's configured base URLs.");
    }

    [Fact]
    public void Validate_should_fail_when_plugin_configuration_rejects_http_client_setup()
    {
        var registry = new FakeTrackerPluginRegistry();
        registry.Register(new FakeTrackerPlugin(
            "plugin",
            [new PluginField("required_ratio", "Required Ratio", null, "number", true, false)],
            configureHttpClient: _ => throw new InvalidOperationException("Bad base URL")));
        var sut = new IntegrationConfigurationValidator(registry);

        var result = sut.Validate("plugin", """{"required_ratio":"1.0"}""");

        result.IsValid.ShouldBeFalse();
        result.Error.ShouldBe("Bad base URL");
    }

    [Fact]
    public void Validate_should_succeed_for_valid_payload()
    {
        var registry = new FakeTrackerPluginRegistry();
        registry.Register(new FakeTrackerPlugin("plugin",
        [
            new PluginField("required_ratio", "Required Ratio", null, "number", true, false),
            new PluginField("username", "Username", null, "text", true, false)
        ]));
        var sut = new IntegrationConfigurationValidator(registry);

        var result = sut.Validate(new Integration
        {
            PluginId = "plugin",
            Payload = """{"required_ratio":"1.0","username":"alice"}"""
        });

        result.IsValid.ShouldBeTrue();
        result.Error.ShouldBeNull();
        result.Plugin.ShouldNotBeNull();
    }
}
