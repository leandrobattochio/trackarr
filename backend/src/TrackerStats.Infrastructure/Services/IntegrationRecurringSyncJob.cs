using Microsoft.Extensions.Logging;

namespace TrackerStats.Infrastructure.Services;

public class IntegrationRecurringSyncJob(
    IntegrationSyncService syncService,
    ILogger<IntegrationRecurringSyncJob> logger)
{
    public async Task ExecuteAsync(Guid integrationId)
    {
        var outcome = await syncService.SyncAsync(integrationId, CancellationToken.None);

        if (!outcome.WasFound)
        {
            logger.LogWarning("Integration {IntegrationId} not found during recurring sync; skipping.", integrationId);
            return;
        }

        if (!outcome.PluginExists)
        {
            logger.LogWarning("Plugin '{PluginId}' not found for integration {IntegrationId}; skipping.", outcome.Integration?.PluginId, integrationId);
            return;
        }

        if (!outcome.ConfigurationIsValid)
        {
            logger.LogWarning(
                "Integration {IntegrationId} is no longer valid for plugin '{PluginId}': {Error}",
                integrationId,
                outcome.Integration?.PluginId,
                outcome.ConfigurationError);
            return;
        }

        logger.LogInformation("Recurring sync finished for integration {IntegrationId} with result {Result}.", integrationId, outcome.Result);
    }
}
