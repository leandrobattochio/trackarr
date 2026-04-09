using Microsoft.AspNetCore.Mvc;
using Shouldly;
using TrackerStats.Api.Controllers;
using TrackerStats.Domain.Services;

namespace TrackerStats.Backend.Tests;

public sealed class UpdateCheckControllerTests
{
    [Fact]
    public async Task Get_should_return_update_check_for_current_version()
    {
        var service = new FakeUpdateCheckService();
        var controller = new UpdateCheckController(new FakeApplicationVersionService("1.0.0"), service);

        var result = await controller.Get(CancellationToken.None);

        var ok = result.ShouldBeOfType<OkObjectResult>();
        var json = TestHttp.ToJson(ok.Value);
        json.GetProperty("currentVersion").GetString().ShouldBe("1.0.0");
        json.GetProperty("latestVersion").GetString().ShouldBe("1.1.0");
        json.GetProperty("updateAvailable").GetBoolean().ShouldBeTrue();
        service.CheckedVersion.ShouldBe("1.0.0");
    }

    private sealed class FakeApplicationVersionService(string version) : IApplicationVersionService
    {
        public string GetVersion() => version;
    }

    private sealed class FakeUpdateCheckService : IUpdateCheckService
    {
        public string? CheckedVersion { get; private set; }

        public Task<UpdateCheckSnapshot> CheckAsync(string currentVersion, CancellationToken ct)
        {
            CheckedVersion = currentVersion;
            return Task.FromResult(new UpdateCheckSnapshot(
                true,
                currentVersion,
                "1.1.0",
                true,
                "https://github.test/release",
                DateTimeOffset.UnixEpoch,
                null));
        }
    }
}
