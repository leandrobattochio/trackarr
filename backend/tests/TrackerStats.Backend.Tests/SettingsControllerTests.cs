using Microsoft.AspNetCore.Mvc;
using Shouldly;
using TrackerStats.Api.Controllers;

namespace TrackerStats.Backend.Tests;

public sealed class SettingsControllerTests
{
    [Fact]
    public void Get_should_return_current_settings()
    {
        var controller = new SettingsController(new FakeApplicationSettingsService("agent-1", checkForUpdates: false));

        var result = controller.Get();

        var ok = result.ShouldBeOfType<OkObjectResult>();
        var json = TestHttp.ToJson(ok.Value);
        json.GetProperty("userAgent").GetString().ShouldBe("agent-1");
        json.GetProperty("checkForUpdates").GetBoolean().ShouldBeFalse();
        json.GetProperty("checkForUpdatesOverridden").GetBoolean().ShouldBeFalse();
    }

    [Fact]
    public async Task Update_should_reject_empty_user_agent()
    {
        var controller = new SettingsController(new FakeApplicationSettingsService("agent-1"));

        var result = await controller.Update(new SettingsController.UpdateSettingsRequest(" ", true), CancellationToken.None);

        var badRequest = result.ShouldBeOfType<BadRequestObjectResult>();
        TestHttp.ToJson(badRequest.Value).GetProperty("error").GetString().ShouldBe("User-Agent must not be empty.");
    }

    [Fact]
    public async Task Update_should_persist_trimmed_user_agent_and_update_check_override()
    {
        var settingsService = new FakeApplicationSettingsService("agent-1");
        var controller = new SettingsController(settingsService);

        var result = await controller.Update(new SettingsController.UpdateSettingsRequest("  agent-2  ", false), CancellationToken.None);

        var ok = result.ShouldBeOfType<OkObjectResult>();
        var json = TestHttp.ToJson(ok.Value);
        json.GetProperty("userAgent").GetString().ShouldBe("agent-2");
        json.GetProperty("checkForUpdates").GetBoolean().ShouldBeFalse();
        json.GetProperty("checkForUpdatesOverridden").GetBoolean().ShouldBeTrue();
        settingsService.GetRequired().UserAgent.ShouldBe("agent-2");
        settingsService.GetRequired().CheckForUpdates.ShouldBeFalse();
    }

    [Fact]
    public async Task Update_should_not_override_update_check_when_value_is_omitted()
    {
        var settingsService = new FakeApplicationSettingsService("agent-1", checkForUpdates: false);
        var controller = new SettingsController(settingsService);

        var result = await controller.Update(new SettingsController.UpdateSettingsRequest("agent-2"), CancellationToken.None);

        var ok = result.ShouldBeOfType<OkObjectResult>();
        var json = TestHttp.ToJson(ok.Value);
        json.GetProperty("userAgent").GetString().ShouldBe("agent-2");
        json.GetProperty("checkForUpdates").GetBoolean().ShouldBeFalse();
        json.GetProperty("checkForUpdatesOverridden").GetBoolean().ShouldBeFalse();
    }
}
