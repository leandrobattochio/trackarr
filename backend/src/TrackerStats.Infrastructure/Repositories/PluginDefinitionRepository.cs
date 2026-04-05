using Microsoft.EntityFrameworkCore;
using TrackerStats.Domain.Entities;
using TrackerStats.Domain.Repositories;
using TrackerStats.Infrastructure.Data;

namespace TrackerStats.Infrastructure.Repositories;

public class PluginDefinitionRepository(AppDbContext db) : IPluginDefinitionRepository
{
    public async Task<PluginDefinition> AddAsync(PluginDefinition definition, CancellationToken ct)
    {
        db.PluginDefinitions.Add(definition);
        await db.SaveChangesAsync(ct);
        return definition;
    }

    public async Task<IReadOnlyList<PluginDefinition>> ListAsync(CancellationToken ct) =>
        await db.PluginDefinitions.ToListAsync(ct);

    public async Task<PluginDefinition?> GetByIdAsync(Guid id, CancellationToken ct) =>
        await db.PluginDefinitions.FindAsync([id], ct);

    public async Task<PluginDefinition?> GetByPluginIdAsync(string pluginId, CancellationToken ct) =>
        await db.PluginDefinitions.FirstOrDefaultAsync(p => p.PluginId == pluginId, ct);

    public async Task UpdateAsync(PluginDefinition definition, CancellationToken ct)
    {
        db.PluginDefinitions.Update(definition);
        await db.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var entity = await GetByIdAsync(id, ct);
        if (entity is not null)
        {
            db.PluginDefinitions.Remove(entity);
            await db.SaveChangesAsync(ct);
        }
    }
}
