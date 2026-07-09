using Microsoft.Extensions.Configuration;
using Shouldly;
using TrackerStats.Infrastructure.Services;

namespace TrackerStats.Backend.Tests;

public sealed class ApplicationVersionServiceTests
{
    [Fact]
    public void GetVersion_should_return_development_version_in_development()
    {
        var sut = new ApplicationVersionService(new FakeHostEnvironment("."), CreateConfiguration(null));

        sut.GetVersion().ShouldBe("0.0.1");
    }

    [Fact]
    public void GetVersion_should_return_configured_development_version_in_development()
    {
        var sut = new ApplicationVersionService(new FakeHostEnvironment("."), CreateConfiguration("0.4.0-dev"));

        sut.GetVersion().ShouldBe("0.4.0-dev");
    }

    private static IConfiguration CreateConfiguration(string? developmentVersion) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Version:DevelopmentVersion"] = developmentVersion
            })
            .Build();
}
