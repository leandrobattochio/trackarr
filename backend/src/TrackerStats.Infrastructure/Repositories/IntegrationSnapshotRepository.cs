using Microsoft.EntityFrameworkCore;
using TrackerStats.Domain.Entities;
using TrackerStats.Domain.Repositories;
using TrackerStats.Infrastructure.Data;

namespace TrackerStats.Infrastructure.Repositories;

public class IntegrationSnapshotRepository(AppDbContext db) : IIntegrationSnapshotRepository
{
    public async Task AddAsync(IntegrationSnapshot snapshot, CancellationToken ct)
    {
        db.IntegrationSnapshots.Add(snapshot);
        await db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<IntegrationSnapshot>> ListByIntegrationAsync(
        Guid integrationId, DateTime? from, DateTime? to, CancellationToken ct)
    {
        var query = db.IntegrationSnapshots
            .Where(s => s.IntegrationId == integrationId);

        if (from.HasValue)
            query = query.Where(s => s.CapturedAt >= from.Value);

        if (to.HasValue)
            query = query.Where(s => s.CapturedAt <= to.Value);

        return await query
            .OrderBy(s => s.CapturedAt)
            .ToListAsync(ct);
    }
}
