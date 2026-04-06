using Microsoft.Extensions.DependencyInjection;
using Shouldly;
using TrackerStats.Domain.Entities;
using TrackerStats.Domain.Repositories;
using TrackerStats.Infrastructure.Services;

namespace TrackerStats.Backend.Tests;

public class IntegrationRecurringJobsBootstrapperTests
{
    [Fact]
    public async Task StartAsync_should_schedule_existing_integrations()
    {
        var repository = new InMemoryIntegrationRepository();
        repository.Seed(new Integration
        {
            Id = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"),
            Payload = """{"cron":"0 0 * * *"}"""
        });
        var manager = new FakeRecurringJobManager();
        var services = new ServiceCollection();
        services.AddScoped<IIntegrationRepository>(_ => repository);
        var scheduler = new IntegrationRecurringJobScheduler(
            manager,
            new FakeJobStorage(new FakeStorageConnection()),
            services.BuildServiceProvider().GetRequiredService<IServiceScopeFactory>());
        var logger = new ListLogger<IntegrationRecurringJobsBootstrapper>();
        var bootstrapper = new IntegrationRecurringJobsBootstrapper(scheduler, logger);

        await bootstrapper.StartAsync(CancellationToken.None);

        manager.AddOrUpdates.ShouldHaveSingleItem();
        logger.Entries.ShouldNotContain(entry => entry.Level >= Microsoft.Extensions.Logging.LogLevel.Error);
    }

    [Fact]
    public async Task StartAsync_should_log_error_when_scheduler_fails()
    {
        var scheduler = new IntegrationRecurringJobScheduler(
            new FakeRecurringJobManager(),
            new FakeJobStorage(new FakeStorageConnection()),
            new ServiceCollection().BuildServiceProvider().GetRequiredService<IServiceScopeFactory>());
        var logger = new ListLogger<IntegrationRecurringJobsBootstrapper>();
        var bootstrapper = new IntegrationRecurringJobsBootstrapper(scheduler, logger);

        await bootstrapper.StartAsync(CancellationToken.None);

        logger.Entries.ShouldContain(entry =>
            entry.Level == Microsoft.Extensions.Logging.LogLevel.Error &&
            entry.Message.Contains("Failed to bootstrap recurring integration jobs.", StringComparison.Ordinal));
    }

    [Fact]
    public async Task StopAsync_should_complete_immediately()
    {
        var scheduler = new IntegrationRecurringJobScheduler(
            new FakeRecurringJobManager(),
            new FakeJobStorage(new FakeStorageConnection()),
            new ServiceCollection().BuildServiceProvider().GetRequiredService<IServiceScopeFactory>());
        var bootstrapper = new IntegrationRecurringJobsBootstrapper(
            scheduler,
            new ListLogger<IntegrationRecurringJobsBootstrapper>());

        await bootstrapper.StopAsync(CancellationToken.None);
    }
}
