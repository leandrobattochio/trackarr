namespace TrackerStats.Domain.Plugins;

public record PluginField(
    string Name,
    string Label,
    string? Description,
    string Type,
    bool Required,
    bool Sensitive = false
);
