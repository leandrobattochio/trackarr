using Microsoft.AspNetCore.Mvc;
using Shouldly;
using TrackerStats.Api.Controllers;
using TrackerStats.Domain.Services;

namespace TrackerStats.Backend.Tests;

public sealed class AboutControllerTests
{
    [Fact]
    public void Get_should_return_database_engine()
    {
        var controller = new AboutController(new FakeAboutService("PostgreSQL"));

        var result = controller.Get();

        var ok = result.ShouldBeOfType<OkObjectResult>();
        var json = TestHttp.ToJson(ok.Value);
        json.GetProperty("databaseEngine").GetString().ShouldBe("PostgreSQL");
        json.GetProperty("version").GetString().ShouldBe("1.0.0-test");
        json.GetProperty("dotNetVersion").GetString().ShouldBe("10.0.0");
        json.GetProperty("runningInDocker").GetBoolean().ShouldBeFalse();
        json.GetProperty("appliedMigrations").GetInt32().ShouldBe(3);
        json.GetProperty("appDataDirectory").GetString().ShouldBe("/data");
        json.GetProperty("startupDirectory").GetString().ShouldBe("/app");
        json.GetProperty("environmentName").GetString().ShouldBe("Development");
        json.GetProperty("uptime").GetString().ShouldBe("01:23:45");
    }
}
