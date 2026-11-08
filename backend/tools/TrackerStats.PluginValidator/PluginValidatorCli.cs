using TrackerStats.Domain.Plugins.Yaml;
using TrackerStats.Infrastructure.Plugins.Storage;
using TrackerStats.Infrastructure.Plugins.Yaml;

namespace TrackerStats.PluginValidator;

public static class PluginValidatorCli
{
    public const int Success = 0;
    public const int InvalidFiles = 1;
    public const int UsageError = 2;

    private const string Usage = "Usage: TrackerStats.PluginValidator [--bases <folder>] <plugin.yaml> [<plugin.yaml> ...]";

    public static int Run(IReadOnlyList<string> args, TextWriter output, TextWriter error)
    {
        var paths = new List<string>();
        string? basesDirectory = null;
        for (var index = 0; index < args.Count; index++)
        {
            if (args[index] != "--bases")
            {
                paths.Add(args[index]);
                continue;
            }

            if (index + 1 >= args.Count)
            {
                error.WriteLine(Usage);
                return UsageError;
            }

            basesDirectory = args[++index];
        }

        if (paths.Count == 0 && basesDirectory is null)
        {
            error.WriteLine(Usage);
            return UsageError;
        }

        if (basesDirectory is not null && !Directory.Exists(basesDirectory))
        {
            error.WriteLine($"Bases folder '{basesDirectory}' does not exist.");
            return UsageError;
        }

        var bases = basesDirectory is null ? null : new PluginBaseStore(basesDirectory);
        // Every .yaml file, so a base whose file name is not a valid id is reported instead of skipped.
        IEnumerable<string> baseFiles = basesDirectory is null ? [] : Directory.EnumerateFiles(basesDirectory, "*.yaml").Order(StringComparer.Ordinal);
        var checks = baseFiles.Select(path => (Path: path, IsBase: true))
            .Concat(paths.Select(path => (Path: path, IsBase: false)))
            .ToList();

        var invalidCount = 0;
        foreach (var (path, isBase) in checks)
        {
            var fileError = isBase ? ValidateBaseFile(path) : ValidateFile(path, bases);
            if (fileError is null)
            {
                output.WriteLine($"OK      {path}");
                continue;
            }

            invalidCount++;
            error.WriteLine($"INVALID {path}: {fileError}");
        }

        output.WriteLine($"{checks.Count - invalidCount} valid, {invalidCount} invalid.");
        return invalidCount == 0 ? Success : InvalidFiles;
    }

    public static string? ValidateFile(string path, IPluginBaseLookup? bases = null)
    {
        var content = ReadFile(path, out var readError);
        if (content is null)
            return readError;

        // Plugins published to the repository are official, so both fields are required.
        var result = PluginDefinitionValidator.Validate(content, requireSchemaVersion: true, requireVersion: true, bases: bases);
        if (!result.IsValid)
            return bases is null && PluginBaseResolver.ReadExtends(content) is not null
                ? $"{result.Error} Pass the bases folder with --bases."
                : result.Error;

        var fileName = Path.GetFileNameWithoutExtension(path);
        var pluginId = result.Definition!.PluginId;
        return string.Equals(fileName, pluginId, StringComparison.Ordinal)
            ? null
            : $"File name '{fileName}' must equal pluginId '{pluginId}'.";
    }

    public static string? ValidateBaseFile(string path)
    {
        var content = ReadFile(path, out var readError);
        if (content is null)
            return readError;

        var result = PluginBaseValidator.Validate(content);
        if (!result.IsValid)
            return result.Error;

        var fileName = Path.GetFileNameWithoutExtension(path);
        return string.Equals(fileName, result.BaseId, StringComparison.Ordinal)
            ? null
            : $"File name '{fileName}' must equal baseId '{result.BaseId}'.";
    }

    private static string? ReadFile(string path, out string? error)
    {
        error = null;
        string content;
        try
        {
            content = File.ReadAllText(path);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            error = $"Cannot read file: {ex.Message}";
            return null;
        }

        if (string.IsNullOrWhiteSpace(content))
        {
            error = "File is empty.";
            return null;
        }

        return content;
    }
}
