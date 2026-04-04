using TrackerStats.Domain.Entities;

namespace TrackerStats.Domain.Repositories;

public interface IIntegrationSnapshotRepository
{
    Task AddAsync(IntegrationSnapshot snapshot, CancellationToken ct);
    Task<IReadOnlyList<IntegrationSnapshot>> ListByIntegrationAsync(Guid integrationId, DateTime? from, DateTime? to, CancellationToken ct);
}
