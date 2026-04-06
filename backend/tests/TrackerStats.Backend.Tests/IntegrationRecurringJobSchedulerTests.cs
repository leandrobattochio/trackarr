using Hangfire;
using Microsoft.Extensions.DependencyInjection;
using Shouldly;
using TrackerStats.Domain.Entities;
using TrackerStats.Domain.Repositories;
using TrackerStats.Infrastructure.Services;

namespace TrackerStats.Backend.Tests;

public class IntegrationRecurringJobSchedulerTests
{
    [Fact]
    public void Schedule_should_add_or_update_job_using_cron_from_payload()
    {
        var manager = new FakeRecurringJobManager();
        var scheduler = CreateScheduler(manager: manager);

        scheduler.Schedule(new Integration
        {
            Id = Guid.Parse("11111111-1111-1111-1111-111111111111"),
            Payload = """{"cron":"0 */6 * * *"}"""
        });

        manager.AddOrUpdates.ShouldHaveSingleItem();
        manager.AddOrUpdates[0].JobId.ShouldBe("integration-sync:11111111111111111111111111111111");
        manager.AddOrUpdates[0].Cron.ShouldBe("0 */6 * * *");
    }

    [Fact]
    public void Schedule_should_throw_when_cron_is_missing()
    {
        var scheduler = CreateScheduler();

        Should.Throw<InvalidOperationException>(() => scheduler.Schedule(new Integration
        {
            Id = Guid.NewGuid(),
            Payload = """{"required_ratio":"1.0"}"""
        })).Message.ShouldContain("missing a cron expression");
    }

    [Fact]
    public async Task EnsureAllScheduledAsync_should_schedule_all_integrations_from_repository()
    {
        var repository = new InMemoryIntegrationRepository();
        repository.Seed(new Integration
        {
            Id = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
            Payload = """{"cron":"0 * * * *"}"""
        });
        repository.Seed(new Integration
        {
            Id = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
            Payload = """{"cron":"30 * * * *"}"""
        });
        var manager = new FakeRecurringJobManager();
        var scheduler = CreateScheduler(repository, manager);

        await scheduler.EnsureAllScheduledAsync(CancellationToken.None);

        manager.AddOrUpdates.Count.ShouldBe(2);
        manager.AddOrUpdates.ShouldContain(x => x.JobId == "integration-sync:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" && x.Cron == "0 * * * *");
        manager.AddOrUpdates.ShouldContain(x => x.JobId == "integration-sync:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" && x.Cron == "30 * * * *");
    }

    [Fact]
    public void Remove_should_forward_to_recurring_job_manager()
    {
        var manager = new FakeRecurringJobManager();
        var scheduler = CreateScheduler(manager: manager);
        var integrationId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");

        scheduler.Remove(integrationId);

        manager.RemovedJobIds.ShouldContain("integration-sync:cccccccccccccccccccccccccccccccc");
    }

    [Fact]
    public void GetNextExecutionUtc_should_return_next_execution_for_existing_job()
    {
        var nextExecution = new DateTime(2026, 4, 5, 18, 0, 0, DateTimeKind.Utc);
        var storage = new FakeJobStorage(new FakeStorageConnection(new Dictionary<string, DateTime?>
        {
            ["integration-sync:dddddddddddddddddddddddddddddddd"] = nextExecution
        }));
        var scheduler = CreateScheduler(storage: storage);

        var result = scheduler.GetNextExecutionUtc(Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd"));

        result.ShouldBe(nextExecution);
    }

    private static IntegrationRecurringJobScheduler CreateScheduler(
        IIntegrationRepository? repository = null,
        IRecurringJobManager? manager = null,
        FakeJobStorage? storage = null)
    {
        var services = new ServiceCollection();
        services.AddScoped(_ => repository ?? new InMemoryIntegrationRepository());

        return new IntegrationRecurringJobScheduler(
            manager ?? new FakeRecurringJobManager(),
            storage ?? new FakeJobStorage(new FakeStorageConnection()),
            services.BuildServiceProvider().GetRequiredService<IServiceScopeFactory>());
    }
}
