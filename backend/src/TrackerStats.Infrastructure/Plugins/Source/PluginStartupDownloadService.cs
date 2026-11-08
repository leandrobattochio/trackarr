using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace TrackerStats.Infrastructure.Plugins.Source;

public sealed class PluginStartupDownloadService(
    PluginDownloadService downloadService,
    ILogger<PluginStartupDownloadService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Yield();
        try
        {
            await downloadService.RunAsync(stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Startup plugin download failed; the plugins on disk are kept.");
        }
    }
}
