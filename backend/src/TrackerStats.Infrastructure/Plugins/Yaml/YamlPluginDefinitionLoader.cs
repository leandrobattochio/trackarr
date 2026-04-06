using System.Data.Common;
using Microsoft.Extensions.Configuration;
using TrackerStats.Domain.Plugins.Yaml;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace TrackerStats.Infrastructure.Plugins.Yaml;

public sealed class YamlPluginDefinitionLoader(IConfiguration configuration) : IYamlPluginDefinitionLoader
{
    private readonly IDeserializer _deserializer = new DeserializerBuilder()
        .WithNamingConvention(CamelCaseNamingConvention.Instance)
        .Build();

    public IReadOnlyList<LoadedYamlPluginDefinition> LoadDefinitions()
    {
        var definitions = new Dictionary<string, LoadedYamlPluginDefinition>(StringComparer.OrdinalIgnoreCase);

        foreach (var definition in LoadDiskDefinitions())
            definitions[definition.PluginId] = definition;

        return definitions.Values
            .OrderBy(definition => definition.PluginId, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private IEnumerable<LoadedYamlPluginDefinition> LoadDiskDefinitions()
    {
        var pluginsDirectory = ResolvePluginsDirectory();

        if (!Directory.Exists(pluginsDirectory))
            yield break;

        foreach (var path in Directory.EnumerateFiles(pluginsDirectory, "*.yaml", SearchOption.TopDirectoryOnly)
                     .OrderBy(path => path, StringComparer.OrdinalIgnoreCase))
        {
            var content = File.ReadAllText(path);
            var fallbackPluginId = Path.GetFileNameWithoutExtension(path);
            var fallbackDisplayName = fallbackPluginId;
            LoadedYamlPluginDefinition loadedDefinition;

            try
            {
                var definition = DeserializeYamlDefinition(content, path);
                RejectReservedFields(definition, path);
                PluginDefinitionDefaults.ApplyDefaults(definition);
                loadedDefinition = new LoadedYamlPluginDefinition(
                    definition.PluginId,
                    definition.DisplayName,
                    definition,
                    content,
                    null);
            }
            catch (Exception ex)
            {
                loadedDefinition = new LoadedYamlPluginDefinition(
                    TryExtractScalar(content, "pluginId") ?? fallbackPluginId,
                    TryExtractScalar(content, "displayName") ?? fallbackDisplayName,
                    null,
                    content,
                    ex.Message);
            }

            yield return loadedDefinition;
        }
    }

    private PluginDefinition DeserializeYamlDefinition(string content, string path) =>
        _deserializer.Deserialize<PluginDefinition>(content)
        ?? throw new InvalidOperationException($"Plugin definition file '{path}' could not be deserialized.");

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

    private string ResolvePluginsDirectory()
    {
        var configuredDirectory = configuration["Plugins:Directory"];
        if (!string.IsNullOrWhiteSpace(configuredDirectory))
            return ResolvePath(configuredDirectory);

        return ResolveSqliteDirectory();
    }

    private string ResolveSqliteDirectory()
    {
        var configuredDatabaseDirectory = configuration["Database:Directory"];
        if (!string.IsNullOrWhiteSpace(configuredDatabaseDirectory))
            return ResolvePath(configuredDatabaseDirectory);

        var connectionString = configuration.GetConnectionString("DefaultConnection");
        if (string.IsNullOrWhiteSpace(connectionString))
            return Path.GetFullPath(AppContext.BaseDirectory);

        var builder = new DbConnectionStringBuilder
        {
            ConnectionString = connectionString
        };

        var dataSourceKey = builder.ContainsKey("Data Source")
            ? "Data Source"
            : builder.ContainsKey("DataSource")
                ? "DataSource"
                : "Data Source";

        var dataSource = builder.TryGetValue(dataSourceKey, out var value)
            ? value?.ToString()
            : null;

        if (string.IsNullOrWhiteSpace(dataSource))
            return Path.GetFullPath(AppContext.BaseDirectory);

        var normalizedDataSource = NormalizeDataSourcePath(dataSource);

        var resolvedPath = Path.IsPathRooted(normalizedDataSource)
            ? normalizedDataSource
            : Path.Combine(AppContext.BaseDirectory, normalizedDataSource);

        var directory = Path.GetDirectoryName(resolvedPath);
        return string.IsNullOrWhiteSpace(directory)
            ? Path.GetFullPath(AppContext.BaseDirectory)
            : Path.GetFullPath(directory);
    }

    private static string ResolvePath(string path) =>
        Path.IsPathRooted(path)
            ? path
            : Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, path));

    private static string NormalizeDataSourcePath(string dataSource) =>
        dataSource.Replace('\\', Path.DirectorySeparatorChar)
            .Replace('/', Path.DirectorySeparatorChar);

}
