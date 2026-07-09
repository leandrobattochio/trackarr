using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Shouldly;
using TrackerStats.Domain.Entities;
using TrackerStats.Infrastructure.Data;
using TrackerStats.Infrastructure.Services;

namespace TrackerStats.Backend.Tests;

public sealed class ApplicationSettingsServiceTests
{
    [Fact]
    public void GetRequired_should_use_environment_flag_until_database_override_exists()
    {
        var sut = CreateSut("false", null);

        var settings = sut.GetRequired();

        settings.CheckForUpdates.ShouldBeFalse();
        settings.CheckForUpdatesOverridden.ShouldBeFalse();
    }

    [Fact]
    public void GetRequired_should_prefer_database_override_over_environment_flag()
    {
        var sut = CreateSut("false", true);

        var settings = sut.GetRequired();

        settings.CheckForUpdates.ShouldBeTrue();
        settings.CheckForUpdatesOverridden.ShouldBeTrue();
    }

    [Fact]
    public async Task UpdateAsync_should_persist_update_check_override()
    {
        var sut = CreateSut("true", null);

        var settings = await sut.UpdateAsync("  agent-2  ", false, CancellationToken.None);

        settings.UserAgent.ShouldBe("agent-2");
        settings.CheckForUpdates.ShouldBeFalse();
        settings.CheckForUpdatesOverridden.ShouldBeTrue();
    }

    [Fact]
    public async Task UpdateUserAgentAsync_should_not_persist_update_check_override()
    {
        var sut = CreateSut("false", null);

        var settings = await sut.UpdateUserAgentAsync("agent-2", CancellationToken.None);

        settings.UserAgent.ShouldBe("agent-2");
        settings.CheckForUpdates.ShouldBeFalse();
        settings.CheckForUpdatesOverridden.ShouldBeFalse();
    }

    private static ApplicationSettingsService CreateSut(string configuredValue, bool? overrideValue)
    {
        var databaseName = $"trackerstats-settings-{Guid.NewGuid():N}";
        var services = new ServiceCollection();
        services.AddDbContext<AppDbContext>(options =>
            options.UseInMemoryDatabase(databaseName));
        var provider = services.BuildServiceProvider();

        using (var scope = provider.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.ApplicationSettings.Add(new ApplicationSettings
            {
                Id = 1,
                UserAgent = "agent-1",
                CheckForUpdatesOverride = overrideValue
            });
            db.SaveChanges();
        }

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Updates:CheckForUpdates"] = configuredValue
            })
            .Build();

        return new ApplicationSettingsService(provider.GetRequiredService<IServiceScopeFactory>(), configuration);
    }
}
