using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using TrackerStats.Domain.Repositories;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;
using YamlPluginDefinition = TrackerStats.Domain.Plugins.Yaml.PluginDefinition;

namespace TrackerStats.Infrastructure.Plugins.Yaml;

public sealed class YamlPluginDefinitionLoader(
    IServiceScopeFactory scopeFactory,
    IConfiguration configuration,
    IHostEnvironment environment) : IYamlPluginDefinitionLoader
{
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
        if (string.IsNullOrWhiteSpace(configuredDirectory))
            return Path.Combine(environment.ContentRootPath, "plugins");

        return Path.IsPathRooted(configuredDirectory)
            ? configuredDirectory
            : Path.GetFullPath(Path.Combine(environment.ContentRootPath, configuredDirectory));
    }
}
