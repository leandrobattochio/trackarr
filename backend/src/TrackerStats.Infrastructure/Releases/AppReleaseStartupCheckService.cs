using Microsoft.Extensions.Hosting;

namespace TrackerStats.Infrastructure.Releases;

public sealed class AppReleaseStartupCheckService(AppReleaseService releaseService) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await releaseService.EnsureCheckedAsync().WaitAsync(stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }
    }
}
