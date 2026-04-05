using System.Text.Json;
using System.Data.Common;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TrackerStats.Domain.Repositories;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;
using YamlPluginDefinition = TrackerStats.Domain.Plugins.Yaml.PluginDefinition;

namespace TrackerStats.Infrastructure.Plugins.Yaml;

public sealed class YamlPluginDefinitionLoader(
    IServiceScopeFactory scopeFactory,
    IConfiguration configuration) : IYamlPluginDefinitionLoader
{
    private static readonly string[] BuiltInPluginFileNames =
    [
        "bj-share.yaml",
        "fearnopeer.yaml",
        "seedpool.yaml"
    ];

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly IDeserializer _deserializer = new DeserializerBuilder()
        .WithNamingConvention(CamelCaseNamingConvention.Instance)
        .IgnoreUnmatchedProperties()
        .Build();

    public IReadOnlyList<LoadedYamlPluginDefinition> LoadDefinitions()
    {
        var definitions = new Dictionary<string, LoadedYamlPluginDefinition>(StringComparer.OrdinalIgnoreCase);

        foreach (var definition in LoadDiskDefinitions())
            definitions[definition.Definition.PluginId] = definition;

        foreach (var definition in LoadDatabaseDefinitions())
            definitions[definition.Definition.PluginId] = definition;

        return definitions.Values
            .OrderBy(definition => definition.Definition.PluginId, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private IEnumerable<LoadedYamlPluginDefinition> LoadDiskDefinitions()
    {
        var pluginsDirectory = ResolvePluginsDirectory();
        SeedBuiltInDefinitions(pluginsDirectory);

        if (!Directory.Exists(pluginsDirectory))
            yield break;

        foreach (var path in Directory.EnumerateFiles(pluginsDirectory, "*.yaml", SearchOption.TopDirectoryOnly)
                     .OrderBy(path => path, StringComparer.OrdinalIgnoreCase))
        {
            var content = File.ReadAllText(path);
            var definition = DeserializeYamlDefinition(content, path);
            yield return new LoadedYamlPluginDefinition(definition, "disk");
        }
    }

    private IEnumerable<LoadedYamlPluginDefinition> LoadDatabaseDefinitions()
    {
        using var scope = scopeFactory.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IPluginDefinitionRepository>();
        var definitions = repository.ListAsync(CancellationToken.None).GetAwaiter().GetResult();

        foreach (var storedDefinition in definitions.OrderBy(definition => definition.PluginId, StringComparer.OrdinalIgnoreCase))
        {
            var definition = JsonSerializer.Deserialize<YamlPluginDefinition>(storedDefinition.DefinitionJson, JsonOptions)
                ?? throw new InvalidOperationException($"Database plugin definition '{storedDefinition.PluginId}' could not be deserialized.");

            yield return new LoadedYamlPluginDefinition(definition, "database");
        }
    }

    private YamlPluginDefinition DeserializeYamlDefinition(string content, string path) =>
        _deserializer.Deserialize<YamlPluginDefinition>(content)
        ?? throw new InvalidOperationException($"Plugin definition file '{path}' could not be deserialized.");

    private string ResolvePluginsDirectory()
    {
        var configuredDirectory = configuration["Plugins:Directory"];
        if (!string.IsNullOrWhiteSpace(configuredDirectory))
            return ResolvePath(configuredDirectory);

        return ResolveSqliteDirectory();
    }

    private void SeedBuiltInDefinitions(string pluginsDirectory)
    {
        Directory.CreateDirectory(pluginsDirectory);

        foreach (var fileName in BuiltInPluginFileNames)
        {
            var sourcePath = Path.Combine(AppContext.BaseDirectory, fileName);
            if (!File.Exists(sourcePath))
                continue;

            var destinationPath = Path.Combine(pluginsDirectory, fileName);
            if (Path.GetFullPath(sourcePath).Equals(Path.GetFullPath(destinationPath), StringComparison.OrdinalIgnoreCase))
                continue;

            if (!File.Exists(destinationPath))
                File.Copy(sourcePath, destinationPath);
        }
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

        var resolvedPath = Path.IsPathRooted(dataSource)
            ? dataSource
            : Path.Combine(AppContext.BaseDirectory, dataSource);

        var directory = Path.GetDirectoryName(resolvedPath);
        return string.IsNullOrWhiteSpace(directory)
            ? Path.GetFullPath(AppContext.BaseDirectory)
            : Path.GetFullPath(directory);
    }

    private static string ResolvePath(string path) =>
        Path.IsPathRooted(path)
            ? path
            : Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, path));
}
