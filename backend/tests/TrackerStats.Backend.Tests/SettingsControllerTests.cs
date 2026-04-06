using Microsoft.AspNetCore.Mvc;
using Shouldly;
using TrackerStats.Api.Controllers;

namespace TrackerStats.Backend.Tests;

public sealed class SettingsControllerTests
{
    [Fact]
    public void Get_should_return_current_user_agent()
    {
        var controller = new SettingsController(new FakeApplicationSettingsService("agent-1"));

        var result = controller.Get();

        var ok = result.ShouldBeOfType<OkObjectResult>();
        TestHttp.ToJson(ok.Value).GetProperty("userAgent").GetString().ShouldBe("agent-1");
    }

    [Fact]
    public async Task Update_should_reject_empty_user_agent()
    {
        var controller = new SettingsController(new FakeApplicationSettingsService("agent-1"));

        var result = await controller.Update(new SettingsController.UpdateSettingsRequest(" "), CancellationToken.None);

        var badRequest = result.ShouldBeOfType<BadRequestObjectResult>();
        TestHttp.ToJson(badRequest.Value).GetProperty("error").GetString().ShouldBe("User-Agent must not be empty.");
    }

    [Fact]
    public async Task Update_should_persist_trimmed_user_agent()
    {
        var settingsService = new FakeApplicationSettingsService("agent-1");
        var controller = new SettingsController(settingsService);

        var result = await controller.Update(new SettingsController.UpdateSettingsRequest("  agent-2  "), CancellationToken.None);

        var ok = result.ShouldBeOfType<OkObjectResult>();
        TestHttp.ToJson(ok.Value).GetProperty("userAgent").GetString().ShouldBe("agent-2");
        settingsService.GetRequired().UserAgent.ShouldBe("agent-2");
    }
}
