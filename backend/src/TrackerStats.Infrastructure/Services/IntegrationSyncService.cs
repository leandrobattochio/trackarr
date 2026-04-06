using System.Text.Json;
using Microsoft.Extensions.Logging;
using TrackerStats.Domain.Entities;
using TrackerStats.Domain.Plugins;
using TrackerStats.Domain.Repositories;

namespace TrackerStats.Infrastructure.Services;

public class IntegrationSyncService(
    IIntegrationRepository integrationRepository,
    IIntegrationSnapshotRepository snapshotRepository,
    ITrackerPluginRegistry registry,
    ITrackerPluginHttpClientFactory httpClientFactory,
    IntegrationConfigurationValidator configurationValidator,
    ILogger<IntegrationSyncService> logger)
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public async Task<IntegrationSyncOutcome> SyncAsync(Guid integrationId, CancellationToken ct)
    {
        var integration = await integrationRepository.GetByIdAsync(integrationId, ct);
        if (integration is null)
            return IntegrationSyncOutcome.NotFound(integrationId);

        var validation = configurationValidator.Validate(integration);
        if (validation.Plugin is null)
            return IntegrationSyncOutcome.PluginMissing(integration);

        if (!validation.IsValid)
            return IntegrationSyncOutcome.InvalidConfiguration(integration, validation.Error ?? "Integration configuration is invalid.");

        try
        {
            var dict = JsonSerializer.Deserialize<Dictionary<string, string?>>(integration.Payload, JsonOptions) ?? [];
            var configuration = new PluginConfiguration(dict);
            var plugin = registry.CreateById(integration.PluginId, configuration)
                ?? throw new InvalidOperationException($"Plugin '{integration.PluginId}' not found.");

            using var httpClient = httpClientFactory.CreateClient(plugin);
            var fetchResult = await plugin.FetchStatsAsync(httpClient, ct);
            if (fetchResult.Result is PluginProcessResult.Success && fetchResult.Stats is null)
                fetchResult = fetchResult with { Result = PluginProcessResult.UnknownError };

            var now = DateTime.UtcNow;

            integration.LastSyncAt = now;
            integration.LastSyncResult = fetchResult.Result;

            if (fetchResult is { Result: PluginProcessResult.Success, Stats: not null })
            {
                ApplyStats(integration, fetchResult.Stats);
                await integrationRepository.UpdateAsync(integration, ct);

                await snapshotRepository.AddAsync(new IntegrationSnapshot
                {
                    Id = Guid.NewGuid(),
                    IntegrationId = integrationId,
                    CapturedAt = now,
                    Ratio = fetchResult.Stats.Ratio,
                    UploadedBytes = fetchResult.Stats.UploadedBytes,
                    DownloadedBytes = fetchResult.Stats.DownloadedBytes,
                    SeedBonus = fetchResult.Stats.SeedBonus,
                    Buffer = fetchResult.Stats.Buffer,
                    HitAndRuns = fetchResult.Stats.HitAndRuns,
                    RequiredRatio = integration.RequiredRatio,
                    SeedingTorrents = fetchResult.Stats.SeedingTorrents,
                    LeechingTorrents = fetchResult.Stats.LeechingTorrents,
                    ActiveTorrents = fetchResult.Stats.ActiveTorrents
                }, ct);

                return IntegrationSyncOutcome.Completed(integration, fetchResult.Result);
            }

            await integrationRepository.UpdateAsync(integration, ct);
            return IntegrationSyncOutcome.Completed(integration, fetchResult.Result);
        }
        catch (Exception ex)
        {
            integration.LastSyncAt = DateTime.UtcNow;
            integration.LastSyncResult = PluginProcessResult.UnknownError;
            await integrationRepository.UpdateAsync(integration, ct);

            logger.LogError(ex, "Failed to sync integration {IntegrationId}.", integrationId);
            return IntegrationSyncOutcome.Completed(integration, PluginProcessResult.UnknownError);
        }
    }

    private static void ApplyStats(Integration integration, Domain.Plugins.TrackerStats stats)
    {
        integration.Ratio = stats.Ratio;
        integration.UploadedBytes = stats.UploadedBytes;
        integration.DownloadedBytes = stats.DownloadedBytes;
        integration.SeedBonus = stats.SeedBonus;
        integration.Buffer = stats.Buffer;
        integration.HitAndRuns = stats.HitAndRuns;
        integration.SeedingTorrents = stats.SeedingTorrents;
        integration.LeechingTorrents = stats.LeechingTorrents;
        integration.ActiveTorrents = stats.ActiveTorrents;
    }
}

public record IntegrationSyncOutcome(
    Integration? Integration,
    PluginProcessResult? Result,
    bool WasFound,
    bool PluginExists,
    bool ConfigurationIsValid,
    string? ConfigurationError)
{
    public static IntegrationSyncOutcome NotFound(Guid integrationId) =>
        new(null, null, WasFound: false, PluginExists: false, ConfigurationIsValid: false, ConfigurationError: null);

    public static IntegrationSyncOutcome PluginMissing(Integration integration) =>
        new(integration, null, WasFound: true, PluginExists: false, ConfigurationIsValid: false, ConfigurationError: null);

    public static IntegrationSyncOutcome InvalidConfiguration(Integration integration, string error) =>
        new(integration, null, WasFound: true, PluginExists: true, ConfigurationIsValid: false, ConfigurationError: error);

    public static IntegrationSyncOutcome Completed(Integration integration, PluginProcessResult result) =>
        new(integration, result, WasFound: true, PluginExists: true, ConfigurationIsValid: true, ConfigurationError: null);
}
