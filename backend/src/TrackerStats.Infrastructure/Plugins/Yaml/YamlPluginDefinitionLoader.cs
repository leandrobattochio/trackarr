using TrackerStats.Domain.Services;
using TrackerStats.Domain.Plugins.Yaml;
using TrackerStats.Infrastructure.Plugins.Storage;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace TrackerStats.Infrastructure.Plugins.Yaml;

public sealed class YamlPluginDefinitionLoader(
    PluginStorageLayout layout,
    PluginBaseStore bases,
    IApplicationSettingsService settingsService) : IYamlPluginDefinitionLoader
{
    private static readonly PluginOrigin[] FolderOrigins = [PluginOrigin.Official, PluginOrigin.Override, PluginOrigin.Custom];

    private readonly IDeserializer _deserializer = new DeserializerBuilder()
        .WithNamingConvention(CamelCaseNamingConvention.Instance)
        .Build();

    public IReadOnlyList<LoadedYamlPluginDefinition> LoadDefinitions() => Resolve(LoadAllDefinitions());

    public IReadOnlyList<LoadedYamlPluginDefinition> LoadAllDefinitions()
    {
        var userAgent = settingsService.GetRequired().UserAgent;
        return FolderOrigins
            .SelectMany(origin => LoadFolder(origin, userAgent))
            .ToList();
    }

    /// <summary>Override wins, then custom (a custom hides an official with the same id), then official.</summary>
    public static IReadOnlyList<LoadedYamlPluginDefinition> Resolve(IEnumerable<LoadedYamlPluginDefinition> definitions) =>
        definitions
            .GroupBy(definition => definition.PluginId, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.OrderBy(definition => GetPrecedence(definition.Origin)).First())
            .OrderBy(definition => definition.PluginId, StringComparer.OrdinalIgnoreCase)
            .ToList();

    private static int GetPrecedence(PluginOrigin origin) => origin switch
    {
        PluginOrigin.Override => 0,
        PluginOrigin.Custom => 1,
        _ => 2
    };

    private IEnumerable<LoadedYamlPluginDefinition> LoadFolder(PluginOrigin origin, string userAgent)
    {
        var directory = layout.GetDirectory(origin);
        if (!Directory.Exists(directory))
            return [];

        var files = new List<(string Path, string FileId, string? DeclaredId, LoadedYamlPluginDefinition Loaded)>();

        foreach (var path in Directory.EnumerateFiles(directory, "*.yaml", SearchOption.TopDirectoryOnly)
                     .Where(path => origin != PluginOrigin.Override || !path.EndsWith(PluginStorageLayout.BaseCopySuffix, StringComparison.OrdinalIgnoreCase))
                     .OrderBy(path => path, StringComparer.Ordinal))
        {
            string content;
            try
            {
                content = File.ReadAllText(path);
            }
            catch (Exception ex) when (ex is FileNotFoundException or DirectoryNotFoundException)
            {
                continue;
            }

            var fileId = Path.GetFileNameWithoutExtension(path);
            var (loaded, declaredId) = LoadFile(path, fileId, content, origin, userAgent);
            files.Add((path, fileId, declaredId, loaded));
        }

        var duplicates = files
            .Where(file => file.DeclaredId is not null)
            .GroupBy(file => file.DeclaredId!, StringComparer.OrdinalIgnoreCase)
            .Where(group => group.Count() > 1)
            .SelectMany(group => group.Select(file => (file.Path, group.Key, Files: group.Select(other => Path.GetFileName(other.Path)).ToList())))
            .ToDictionary(entry => entry.Path, entry => (Id: entry.Key, entry.Files), StringComparer.Ordinal);

        return files.Select(file =>
        {
            var layoutError = duplicates.TryGetValue(file.Path, out var duplicate)
                ? $"Plugin id '{duplicate.Id}' is declared by more than one file in {Path.GetFileName(directory)}/: {string.Join(", ", duplicate.Files)}. Each plugin id must be declared by exactly one file."
                : GetFileNameError(file.FileId, file.DeclaredId);

            return layoutError is null
                ? file.Loaded
                : file.Loaded with
                {
                    Definition = null,
                    Incompatible = false,
                    Error = $"Plugin definition '{file.Path}' is invalid. {layoutError}"
                };
        });
    }

    private static string? GetFileNameError(string fileId, string? declaredId)
    {
        if (!PluginSchema.IsValidPluginId(fileId))
            return $"File name '{fileId}.yaml' is not a valid plugin id. {PluginSchema.GetInvalidPluginIdMessage(fileId)}";

        if (declaredId is not null && !string.Equals(declaredId, fileId, StringComparison.Ordinal))
            return $"File name '{fileId}.yaml' does not match pluginId '{declaredId}'. The file must be named '{declaredId}.yaml'.";

        return null;
    }

    private (LoadedYamlPluginDefinition Loaded, string? DeclaredId) LoadFile(
        string path,
        string fileId,
        string content,
        PluginOrigin origin,
        string userAgent)
    {
        var scalarId = TryExtractScalar(content, "pluginId");
        var displayName = TryExtractScalar(content, "displayName") ?? fileId;

        var incompatibilityError = PluginSchemaVersionReader.GetIncompatibilityError(content);
        if (incompatibilityError is not null)
        {
            return (new LoadedYamlPluginDefinition(
                fileId,
                displayName,
                null,
                content,
                $"Plugin definition '{path}' is incompatible. {incompatibilityError}",
                Incompatible: true,
                Origin: origin,
                FilePath: path), scalarId);
        }

        PluginDefinition? definition = null;
        try
        {
            definition = DeserializeYamlDefinition(content, path);
            if (string.IsNullOrWhiteSpace(definition.PluginId) || string.IsNullOrWhiteSpace(definition.DisplayName))
                throw new InvalidOperationException($"Plugin definition '{path}' is invalid. PluginId and displayName are required.");

            RejectVersionViolation(definition, path);
            RejectReservedFields(definition, path);
            PluginDefinitionDefaults.ApplyDefaults(definition, userAgent);
            return (new LoadedYamlPluginDefinition(
                fileId,
                definition.DisplayName,
                definition,
                content,
                null,
                Origin: origin,
                FilePath: path), definition.PluginId);
        }
        catch (Exception ex)
        {
            var declaredId = string.IsNullOrWhiteSpace(definition?.PluginId) ? scalarId : definition.PluginId;
            return (new LoadedYamlPluginDefinition(
                fileId,
                displayName,
                null,
                content,
                ex.Message,
                Origin: origin,
                FilePath: path), declaredId);
        }
    }

    private PluginDefinition DeserializeYamlDefinition(string content, string path)
    {
        var definition = _deserializer.Deserialize<PluginDefinition>(content)
            ?? throw new InvalidOperationException($"Plugin definition file '{path}' could not be deserialized.");
        if (definition.Extends is null)
            return definition;

        RejectVersionViolation(definition, path);
        var resolution = PluginBaseResolver.Resolve(content, bases);
        if (!resolution.Succeeded)
            throw new InvalidOperationException($"Plugin definition '{path}' is invalid. {resolution.Error}");

        return _deserializer.Deserialize<PluginDefinition>(resolution.Yaml)
            ?? throw new InvalidOperationException($"Plugin definition file '{path}' could not be deserialized.");
    }

    private static void RejectVersionViolation(PluginDefinition definition, string source)
    {
        var violation = PluginSchema.GetVersionViolation(definition, requireSchemaVersion: false, requireVersion: false);
        if (violation is not null)
            throw new InvalidOperationException($"Plugin definition '{source}' is invalid. {violation}");
    }

    private static void RejectReservedFields(PluginDefinition definition, string source)
    {
        var violation = PluginDefinitionDefaults.GetReservedPropertyViolation(definition);
        if (violation is not null)
            throw new InvalidOperationException($"Plugin definition '{source}' is invalid. {violation}");
    }

    private static string? TryExtractScalar(string content, string key)
    {
        foreach (var rawLine in content.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries))
        {
            var line = rawLine.Trim();
            if (!line.StartsWith($"{key}:", StringComparison.Ordinal))
                continue;

            var value = line[(key.Length + 1)..].Trim().Trim('"', '\'');
            return string.IsNullOrWhiteSpace(value) ? null : value;
        }

        return null;
    }
}
