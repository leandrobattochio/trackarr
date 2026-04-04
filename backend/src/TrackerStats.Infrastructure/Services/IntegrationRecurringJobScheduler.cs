using Hangfire;
using Hangfire.Storage;
using Microsoft.Extensions.DependencyInjection;
using System.Text.Json;
using TrackerStats.Domain.Entities;
using TrackerStats.Domain.Repositories;

namespace TrackerStats.Infrastructure.Services;

public class IntegrationRecurringJobScheduler(
    IRecurringJobManager recurringJobManager,
    JobStorage jobStorage,
    IServiceScopeFactory scopeFactory)
{
    private const string JobPrefix = "integration-sync:";

    public async Task EnsureAllScheduledAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IIntegrationRepository>();
        var integrations = await repository.ListAsync(ct);

        foreach (var integration in integrations)
            Schedule(integration);
    }

    public void Schedule(Integration integration)
    {
        var cronExpression = GetCronExpression(integration);

        recurringJobManager.AddOrUpdate<IntegrationRecurringSyncJob>(
            GetJobId(integration.Id),
            job => job.ExecuteAsync(integration.Id),
            cronExpression,
            new RecurringJobOptions
            {
                TimeZone = TimeZoneInfo.Utc
            });
    }

    public void Remove(Guid integrationId) =>
        recurringJobManager.RemoveIfExists(GetJobId(integrationId));

    public DateTime? GetNextExecutionUtc(Guid integrationId)
    {
        using var connection = jobStorage.GetConnection();
        var recurringJob = connection
            .GetRecurringJobs()
            .FirstOrDefault(job => string.Equals(job.Id, GetJobId(integrationId), StringComparison.Ordinal));

        return recurringJob?.NextExecution;
    }

    private static string GetCronExpression(Integration integration)
    {
        var payload = JsonSerializer.Deserialize<Dictionary<string, string?>>(integration.Payload)
            ?? throw new InvalidOperationException($"Integration '{integration.Id}' payload is invalid.");

        var cronExpression = payload.GetValueOrDefault("cron");
        if (string.IsNullOrWhiteSpace(cronExpression))
            throw new InvalidOperationException($"Integration '{integration.Id}' is missing a cron expression.");

        return cronExpression;
    }

    private static string GetJobId(Guid integrationId) => $"{JobPrefix}{integrationId:N}";
}
