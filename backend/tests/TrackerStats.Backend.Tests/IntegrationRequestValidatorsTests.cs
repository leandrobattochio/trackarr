using Shouldly;
using TrackerStats.Api.Controllers;
using TrackerStats.Domain.Plugins;
using TrackerStats.Infrastructure.Services;

namespace TrackerStats.Backend.Tests;

public class IntegrationRequestValidatorsTests
{
    [Fact]
    public async Task Create_validator_should_require_plugin_id_and_payload()
    {
        var registry = new FakeTrackerPluginRegistry();
        var validator = new CreateIntegrationRequestValidator(registry, new IntegrationConfigurationValidator(registry));

        var result = await validator.ValidateAsync(new CreateIntegrationRequest("", ""));

        result.IsValid.ShouldBeFalse();
        result.Errors.Select(error => error.ErrorMessage).ShouldBe([
            "PluginId is required.",
            "Payload is required."
        ]);
    }

    [Fact]
    public async Task Create_validator_should_fail_when_plugin_is_missing()
    {
        var registry = new FakeTrackerPluginRegistry();
        var validator = new CreateIntegrationRequestValidator(registry, new IntegrationConfigurationValidator(registry));

        var result = await validator.ValidateAsync(new CreateIntegrationRequest("missing", """{"required_ratio":"1.0"}"""));

        result.IsValid.ShouldBeFalse();
        result.Errors.ShouldHaveSingleItem().ErrorMessage.ShouldBe("Plugin 'missing' not found.");
    }

    [Fact]
    public async Task Create_validator_should_fail_when_payload_is_invalid()
    {
        var registry = new FakeTrackerPluginRegistry();
        registry.Register(new FakeTrackerPlugin("plugin",
        [
            new PluginField("baseUrl", "Base URL", "text", true, false),
            new PluginField("required_ratio", "Required Ratio", "number", true, false),
            new PluginField("cron", "Cron", "cron", true, false)
        ]));
        var validator = new CreateIntegrationRequestValidator(registry, new IntegrationConfigurationValidator(registry));

        var result = await validator.ValidateAsync(
            new CreateIntegrationRequest("plugin", """{"baseUrl":"https://tracker.test","required_ratio":"1.0","cron":"* * *"}"""));

        result.IsValid.ShouldBeFalse();
        result.Errors.ShouldHaveSingleItem().ErrorMessage.ShouldBe("Field 'cron' must be a valid 5-part UTC cron expression.");
    }

    [Fact]
    public async Task Create_validator_should_fail_when_base_url_host_is_incomplete()
    {
        var registry = new FakeTrackerPluginRegistry();
        registry.Register(new FakeTrackerPlugin("plugin",
        [
            new PluginField("baseUrl", "Base URL", "text", true, false),
            new PluginField("required_ratio", "Required Ratio", "number", true, false),
            new PluginField("cron", "Cron", "cron", true, false)
        ]));
        var validator = new CreateIntegrationRequestValidator(registry, new IntegrationConfigurationValidator(registry));

        var result = await validator.ValidateAsync(
            new CreateIntegrationRequest("plugin", """{"baseUrl":"http://www","required_ratio":"1.0","cron":"0 * * * *"}"""));

        result.IsValid.ShouldBeFalse();
        result.Errors.ShouldHaveSingleItem().ErrorMessage.ShouldBe("Field 'baseUrl' must be a valid http:// or https:// URL.");
    }

    [Fact]
    public async Task Create_validator_should_succeed_for_valid_request()
    {
        var registry = new FakeTrackerPluginRegistry();
        registry.Register(new FakeTrackerPlugin("plugin",
        [
            new PluginField("baseUrl", "Base URL", "text", true, false),
            new PluginField("required_ratio", "Required Ratio", "number", true, false),
            new PluginField("cron", "Cron", "cron", true, false)
        ]));
        var validator = new CreateIntegrationRequestValidator(registry, new IntegrationConfigurationValidator(registry));

        var result = await validator.ValidateAsync(
            new CreateIntegrationRequest("plugin", """{"baseUrl":"https://tracker.test","required_ratio":"1.0","cron":"0 * * * *"}"""));

        result.IsValid.ShouldBeTrue();
    }

    [Fact]
    public async Task Create_validator_should_allow_localhost_url()
    {
        var registry = new FakeTrackerPluginRegistry();
        registry.Register(new FakeTrackerPlugin("plugin",
        [
            new PluginField("baseUrl", "Base URL", "text", true, false),
            new PluginField("required_ratio", "Required Ratio", "number", true, false),
            new PluginField("cron", "Cron", "cron", true, false)
        ]));
        var validator = new CreateIntegrationRequestValidator(registry, new IntegrationConfigurationValidator(registry));

        var result = await validator.ValidateAsync(
            new CreateIntegrationRequest("plugin", """{"baseUrl":"http://localhost:8080","required_ratio":"1.0","cron":"0 * * * *"}"""));

        result.IsValid.ShouldBeTrue();
    }

    [Fact]
    public async Task Update_validator_should_fail_when_payload_is_invalid()
    {
        var registry = new FakeTrackerPluginRegistry();
        registry.Register(new FakeTrackerPlugin("plugin",
        [
            new PluginField("baseUrl", "Base URL", "text", true, false),
            new PluginField("required_ratio", "Required Ratio", "number", true, false),
            new PluginField("cron", "Cron", "cron", true, false)
        ]));
        var validator = new UpdateIntegrationRequestValidator(registry, new IntegrationConfigurationValidator(registry));

        var result = await validator.ValidateAsync(
            new UpdateIntegrationRequest("plugin", """{"baseUrl":"https://tracker.test","required_ratio":"nope","cron":"0 * * * *"}"""));

        result.IsValid.ShouldBeFalse();
        result.Errors.ShouldHaveSingleItem().ErrorMessage.ShouldBe("Field 'required_ratio' must be a valid decimal number.");
    }
}
