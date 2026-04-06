using Microsoft.EntityFrameworkCore;
using Shouldly;
using TrackerStats.Domain.Entities;
using TrackerStats.Infrastructure.Data;
using TrackerStats.Infrastructure.Repositories;

namespace TrackerStats.Backend.Tests;

public sealed class RepositoryTests
{
    private readonly DbContextOptions<AppDbContext> _options;

    public RepositoryTests()
    {
        _options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"trackerstats-tests-{Guid.NewGuid():N}")
            .Options;

        using var db = CreateDbContext();
        db.Database.EnsureCreated();
    }

    [Fact]
    public async Task IntegrationRepository_should_add_list_exists_update_and_delete_with_snapshots()
    {
        var integrationId = Guid.NewGuid();

        await using (var db = CreateDbContext())
        {
            var repository = new IntegrationRepository(db);
            var integration = new Integration
            {
                Id = integrationId,
                PluginId = "seedpool",
                Payload = """{"required_ratio":"1.5","cron":"0 * * * *"}""",
                RequiredRatio = 1.5m
            };

            await repository.AddAsync(integration, CancellationToken.None);
            (await repository.ExistsByPluginIdAsync("seedpool", CancellationToken.None)).ShouldBeTrue();

            var listed = await repository.ListAsync(CancellationToken.None);
            listed.Count.ShouldBe(1);

            var loaded = await repository.GetByIdAsync(integrationId, CancellationToken.None);
            loaded.ShouldNotBeNull();
            loaded.PluginId.ShouldBe("seedpool");

            loaded.RequiredRatio = 2.0m;
            await repository.UpdateAsync(loaded, CancellationToken.None);

            db.IntegrationSnapshots.Add(new IntegrationSnapshot
            {
                Id = Guid.NewGuid(),
                IntegrationId = integrationId,
                CapturedAt = new DateTime(2026, 4, 5, 10, 0, 0, DateTimeKind.Utc),
                Ratio = 2.0m
            });
            await db.SaveChangesAsync();

            await repository.DeleteAsync(integrationId, CancellationToken.None);
        }

        await using (var db = CreateDbContext())
        {
            var repository = new IntegrationRepository(db);

            (await repository.GetByIdAsync(integrationId, CancellationToken.None)).ShouldBeNull();
            (await repository.ListAsync(CancellationToken.None)).ShouldBeEmpty();
            (await repository.ExistsByPluginIdAsync("seedpool", CancellationToken.None)).ShouldBeFalse();
            db.IntegrationSnapshots.ShouldBeEmpty();
        }
    }

    [Fact]
    public async Task IntegrationSnapshotRepository_should_filter_and_sort_by_capture_time()
    {
        var integrationId = Guid.NewGuid();

        await using (var db = CreateDbContext())
        {
            db.Integrations.Add(new Integration
            {
                Id = integrationId,
                PluginId = "seedpool",
                Payload = """{"required_ratio":"1.5","cron":"0 * * * *"}""",
                RequiredRatio = 1.5m
            });
            await db.SaveChangesAsync();

            var repository = new IntegrationSnapshotRepository(db);
            await repository.AddAsync(new IntegrationSnapshot
            {
                Id = Guid.NewGuid(),
                IntegrationId = integrationId,
                CapturedAt = new DateTime(2026, 4, 5, 11, 0, 0, DateTimeKind.Utc),
                Ratio = 1.1m
            }, CancellationToken.None);
            await repository.AddAsync(new IntegrationSnapshot
            {
                Id = Guid.NewGuid(),
                IntegrationId = integrationId,
                CapturedAt = new DateTime(2026, 4, 5, 9, 0, 0, DateTimeKind.Utc),
                Ratio = 0.9m
            }, CancellationToken.None);
            await repository.AddAsync(new IntegrationSnapshot
            {
                Id = Guid.NewGuid(),
                IntegrationId = integrationId,
                CapturedAt = new DateTime(2026, 4, 5, 13, 0, 0, DateTimeKind.Utc),
                Ratio = 1.3m
            }, CancellationToken.None);
        }

        await using (var db = CreateDbContext())
        {
            var repository = new IntegrationSnapshotRepository(db);

            var snapshots = await repository.ListByIntegrationAsync(
                integrationId,
                new DateTime(2026, 4, 5, 10, 0, 0, DateTimeKind.Utc),
                new DateTime(2026, 4, 5, 13, 0, 0, DateTimeKind.Utc),
                CancellationToken.None);

            snapshots.Count.ShouldBe(2);
            snapshots[0].Ratio.ShouldBe(1.1m);
            snapshots[1].Ratio.ShouldBe(1.3m);
        }
    }

    private AppDbContext CreateDbContext() => new(_options);
}
