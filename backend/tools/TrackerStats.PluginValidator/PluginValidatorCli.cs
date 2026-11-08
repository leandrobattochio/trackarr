using TrackerStats.Infrastructure.Plugins.Yaml;

namespace TrackerStats.PluginValidator;

public static class PluginValidatorCli
{
    public const int Success = 0;
    public const int InvalidFiles = 1;
    public const int UsageError = 2;

    public static int Run(IReadOnlyList<string> paths, TextWriter output, TextWriter error)
    {
        if (paths.Count == 0)
        {
            error.WriteLine("Usage: TrackerStats.PluginValidator <plugin.yaml> [<plugin.yaml> ...]");
            return UsageError;
        }

        var invalidCount = 0;
        foreach (var path in paths)
        {
            var fileError = ValidateFile(path);
            if (fileError is null)
            {
                output.WriteLine($"OK      {path}");
                continue;
            }

            invalidCount++;
            error.WriteLine($"INVALID {path}: {fileError}");
        }

        output.WriteLine($"{paths.Count - invalidCount} valid, {invalidCount} invalid.");
        return invalidCount == 0 ? Success : InvalidFiles;
    }

    public static string? ValidateFile(string path)
    {
        string content;
        try
        {
            content = File.ReadAllText(path);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            return $"Cannot read file: {ex.Message}";
        }

        if (string.IsNullOrWhiteSpace(content))
            return "File is empty.";

        // Plugins published to the repository are official, so both fields are required.
        var result = PluginDefinitionValidator.Validate(content, requireSchemaVersion: true, requireVersion: true);
        if (!result.IsValid)
            return result.Error;

        var fileName = Path.GetFileNameWithoutExtension(path);
        var pluginId = result.Definition!.PluginId;
        return string.Equals(fileName, pluginId, StringComparison.Ordinal)
            ? null
            : $"File name '{fileName}' must equal pluginId '{pluginId}'.";
    }
}
