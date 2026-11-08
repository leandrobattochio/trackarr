using TrackerStats.Domain.Entities;

namespace TrackerStats.Domain.Repositories;

public interface IProxyRepository
{
    Task<IReadOnlyList<TrackerProxy>> ListAsync(CancellationToken ct);
    Task<TrackerProxy?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<bool> NameExistsAsync(string name, Guid? exceptId, CancellationToken ct);
    Task<IReadOnlyList<Integration>> ListIntegrationsUsingAsync(Guid proxyId, CancellationToken ct);
    Task AddAsync(TrackerProxy proxy, CancellationToken ct);
    Task UpdateAsync(TrackerProxy proxy, CancellationToken ct);
    Task DeleteAsync(TrackerProxy proxy, CancellationToken ct);
}
