using Microsoft.EntityFrameworkCore;
using Shouldly;
using TrackerStats.Infrastructure.Data;

namespace TrackerStats.Backend.Tests;

public sealed class AppDbContextTests
{
    [Fact]
    public async Task EnsureSeedDataAsync_should_insert_default_application_settings_when_missing()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"trackerstats-dbcontext-tests-{Guid.NewGuid():N}")
            .Options;

        await using var db = new AppDbContext(options);

        await db.EnsureSeedDataAsync();

        var settings = await db.ApplicationSettings.SingleAsync();
        settings.Id.ShouldBe(1);
        settings.UserAgent.ShouldBe(AppDbContext.DefaultUserAgent);
        settings.CheckForUpdatesOverride.ShouldBeNull();
    }

    [Fact]
    public async Task EnsureSeedDataAsync_should_not_overwrite_existing_application_settings()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"trackerstats-dbcontext-tests-{Guid.NewGuid():N}")
            .Options;

        await using (var db = new AppDbContext(options))
        {
            db.ApplicationSettings.Add(new TrackerStats.Domain.Entities.ApplicationSettings
            {
                Id = 1,
                UserAgent = "custom-agent",
                CheckForUpdatesOverride = false
            });
            await db.SaveChangesAsync();
        }

        await using (var db = new AppDbContext(options))
        {
            await db.EnsureSeedDataAsync();
        }

        await using (var db = new AppDbContext(options))
        {
            var settings = await db.ApplicationSettings.SingleAsync();
            settings.UserAgent.ShouldBe("custom-agent");
            settings.CheckForUpdatesOverride.ShouldBe(false);
        }
    }
}
