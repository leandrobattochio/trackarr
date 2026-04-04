using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace TrackerStats.Infrastructure.Services;

public class IntegrationRecurringJobsBootstrapper(
    IntegrationRecurringJobScheduler scheduler,
    ILogger<IntegrationRecurringJobsBootstrapper> logger)
    : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            await scheduler.EnsureAllScheduledAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to bootstrap recurring integration jobs.");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) =>
        Task.CompletedTask;
}
