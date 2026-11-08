using Microsoft.EntityFrameworkCore;
using TrackerStats.Domain.Entities;
using TrackerStats.Domain.Repositories;
using TrackerStats.Infrastructure.Data;

namespace TrackerStats.Infrastructure.Repositories;

public class IntegrationRepository(AppDbContext db) : IIntegrationRepository
{
    public async Task<Integration> AddAsync(Integration integration, CancellationToken ct)
    {
        db.Integrations.Add(integration);
        await db.SaveChangesAsync(ct);
        return integration;
    }

    public async Task<IReadOnlyList<Integration>> ListAsync(CancellationToken ct) =>
        await db.Integrations.Include(integration => integration.Proxy).ToListAsync(ct);

    public async Task<Integration?> GetByIdAsync(Guid id, CancellationToken ct) =>
        await db.Integrations.Include(integration => integration.Proxy)
            .FirstOrDefaultAsync(integration => integration.Id == id, ct);

    public async Task<bool> ExistsByPluginIdAsync(string pluginId, CancellationToken ct) =>
        await db.Integrations.AnyAsync(
            integration => integration.PluginId == pluginId,
            ct);

    public async Task UpdateAsync(Integration integration, CancellationToken ct)
    {
        db.Integrations.Update(integration);
        // Update walks the graph; the loaded proxy is only read here, never saved through its integration.
        if (integration.Proxy is not null)
            db.Entry(integration.Proxy).State = EntityState.Unchanged;
        await db.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var entity = await GetByIdAsync(id, ct);
        if (entity is not null)
        {
            var snapshots = await db.IntegrationSnapshots
                .Where(snapshot => snapshot.IntegrationId == id)
                .ToListAsync(ct);

            if (snapshots.Count > 0)
                db.IntegrationSnapshots.RemoveRange(snapshots);

            db.Integrations.Remove(entity);
            await db.SaveChangesAsync(ct);
        }
    }
}
