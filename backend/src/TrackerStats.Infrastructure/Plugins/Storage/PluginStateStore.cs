using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace TrackerStats.Infrastructure.Plugins.Storage;

public sealed record OfficialPluginState(string Version, string Sha256);

public sealed record OverridePluginState(string BaseVersion, string BaseSha256);

public sealed class PluginState
{
    public Dictionary<string, OfficialPluginState> Official { get; set; } = new(StringComparer.Ordinal);
    public Dictionary<string, OverridePluginState> Overrides { get; set; } = new(StringComparer.Ordinal);
    public DateTimeOffset? LegacyCleanupCompletedAt { get; set; }
    public PluginIndexState? Index { get; set; }
    public PluginDownloadReport? LastDownload { get; set; }
    public List<PluginUpdateRecord> Updates { get; set; } = [];
    // Never reused, even after old Updates are trimmed.
    public long LastUpdateId { get; set; }
}

public sealed class PluginStateStore(PluginStorageLayout layout)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
    };
    private readonly Lock _gate = new();

    public PluginState Load()
    {
        lock (_gate)
        {
            if (!File.Exists(layout.StateFilePath))
                return new PluginState();

            try
            {
                var state = JsonSerializer.Deserialize<PluginState>(File.ReadAllText(layout.StateFilePath), JsonOptions)
                    ?? new PluginState();
                state.Official ??= new(StringComparer.Ordinal);
                state.Overrides ??= new(StringComparer.Ordinal);
                state.Updates ??= [];
                return state;
            }
            catch (JsonException ex)
            {
                throw new InvalidOperationException($"Plugin state file '{layout.StateFilePath}' is not valid JSON: {ex.Message}", ex);
            }
        }
    }

    public void Save(PluginState state)
    {
        lock (_gate)
        {
            Directory.CreateDirectory(layout.PluginsRoot);
            var temporaryPath = $"{layout.StateFilePath}.tmp";
            File.WriteAllText(temporaryPath, JsonSerializer.Serialize(state, JsonOptions));
            File.Move(temporaryPath, layout.StateFilePath, overwrite: true);
        }
    }

    public void Update(Action<PluginState> change)
    {
        lock (_gate)
        {
            var state = Load();
            change(state);
            Save(state);
        }
    }

    /// <summary>Lowercase hex sha256, the format <c>index.json</c> uses.</summary>
    public static string ComputeSha256(ReadOnlySpan<byte> content) =>
        Convert.ToHexStringLower(SHA256.HashData(content));

    public static string ComputeFileSha256(string path) => ComputeSha256(File.ReadAllBytes(path));
}
