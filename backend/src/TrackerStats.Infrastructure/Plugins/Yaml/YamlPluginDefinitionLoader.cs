using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using TrackerStats.Domain.Services;
using TrackerStats.Domain.Plugins.Yaml;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace TrackerStats.Infrastructure.Plugins.Yaml;

public sealed class YamlPluginDefinitionLoader(
    IConfiguration configuration,
    IApplicationSettingsService settingsService,
    IHostEnvironment? hostEnvironment = null) : IYamlPluginDefinitionLoader
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
        var settings = settingsService.GetRequired();

        if (!Directory.Exists(pluginsDirectory))
            yield break;

        foreach (var path in Directory.EnumerateFiles(pluginsDirectory, "*.yaml", SearchOption.TopDirectoryOnly)
                     .OrderBy(path => path, StringComparer.OrdinalIgnoreCase))
        {
            string content;

            try
            {
                content = File.ReadAllText(path);
            }
            catch (FileNotFoundException)
            {
                continue;
            }
            catch (DirectoryNotFoundException)
            {
                continue;
            }

            var fallbackPluginId = Path.GetFileNameWithoutExtension(path);
            var fallbackDisplayName = fallbackPluginId;
            LoadedYamlPluginDefinition loadedDefinition;

            try
            {
                var definition = DeserializeYamlDefinition(content, path);
                RejectReservedFields(definition, path);
                PluginDefinitionDefaults.ApplyDefaults(definition, settings.UserAgent);
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

        return Path.GetFullPath(GetBasePath());
    }

    private string ResolvePath(string path) =>
        Path.IsPathRooted(path)
            ? path
            : Path.GetFullPath(Path.Combine(GetBasePath(), path));

    private string GetBasePath() =>
        string.IsNullOrWhiteSpace(hostEnvironment?.ContentRootPath)
            ? AppContext.BaseDirectory
            : hostEnvironment.ContentRootPath;
}
