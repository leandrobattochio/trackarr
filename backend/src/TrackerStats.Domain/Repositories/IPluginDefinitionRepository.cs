using TrackerStats.Domain.Entities;

namespace TrackerStats.Domain.Repositories;

public interface IPluginDefinitionRepository
{
    Task<PluginDefinition> AddAsync(PluginDefinition definition, CancellationToken ct);
    Task<IReadOnlyList<PluginDefinition>> ListAsync(CancellationToken ct);
    Task<PluginDefinition?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<PluginDefinition?> GetByPluginIdAsync(string pluginId, CancellationToken ct);
    Task UpdateAsync(PluginDefinition definition, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
}
