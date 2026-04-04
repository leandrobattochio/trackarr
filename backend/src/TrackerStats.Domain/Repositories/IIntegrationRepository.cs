using TrackerStats.Domain.Entities;

namespace TrackerStats.Domain.Repositories;

public interface IIntegrationRepository
{
    Task<Integration> AddAsync(Integration integration, CancellationToken ct);
    Task<IReadOnlyList<Integration>> ListAsync(CancellationToken ct);
    Task<Integration?> GetByIdAsync(Guid id, CancellationToken ct);
    Task UpdateAsync(Integration integration, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
}
