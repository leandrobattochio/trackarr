using Microsoft.EntityFrameworkCore;
using TrackerStats.Domain.Entities;
using TrackerStats.Domain.Repositories;
using TrackerStats.Infrastructure.Data;

namespace TrackerStats.Infrastructure.Repositories;

public class ProxyRepository(AppDbContext db) : IProxyRepository
{
    public async Task<IReadOnlyList<TrackerProxy>> ListAsync(CancellationToken ct) =>
        await db.Proxies.OrderBy(proxy => proxy.Name).ToListAsync(ct);

    public async Task<TrackerProxy?> GetByIdAsync(Guid id, CancellationToken ct) =>
        await db.Proxies.FindAsync([id], ct);

    public async Task<bool> NameExistsAsync(string name, Guid? exceptId, CancellationToken ct) =>
        await db.Proxies.AnyAsync(proxy => proxy.Name == name && proxy.Id != exceptId, ct);

    public async Task<IReadOnlyList<Integration>> ListIntegrationsUsingAsync(Guid proxyId, CancellationToken ct) =>
        await db.Integrations.Where(integration => integration.ProxyId == proxyId).ToListAsync(ct);

    public async Task AddAsync(TrackerProxy proxy, CancellationToken ct)
    {
        db.Proxies.Add(proxy);
        await db.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(TrackerProxy proxy, CancellationToken ct)
    {
        db.Proxies.Update(proxy);
        await db.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(TrackerProxy proxy, CancellationToken ct)
    {
        db.Proxies.Remove(proxy);
        await db.SaveChangesAsync(ct);
    }
}
