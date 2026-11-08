using System.Text.RegularExpressions;

namespace TrackerStats.Domain.Plugins.Yaml;

public enum PluginSchemaCompatibility
{
    Missing,
    Invalid,
    Supported,
    Incompatible
}

public static partial class PluginSchema
{
    // Every change to the plugin YAML format must increment this.
    public const int SupportedPluginSchemaVersion = 1;

    public static PluginSchemaCompatibility GetCompatibility(
        int? schemaVersion,
        int supportedSchemaVersion = SupportedPluginSchemaVersion) => schemaVersion switch
        {
            null => PluginSchemaCompatibility.Missing,
            < 1 => PluginSchemaCompatibility.Invalid,
            _ when schemaVersion > supportedSchemaVersion => PluginSchemaCompatibility.Incompatible,
            _ => PluginSchemaCompatibility.Supported
        };

    public static string GetIncompatibleMessage(int schemaVersion) =>
        $"Plugin requires schema version {schemaVersion}, but this trackarr supports up to {SupportedPluginSchemaVersion}. Update trackarr to use it.";

    public static string GetUpdateRequiredMessage(string pluginId, string version, int schemaVersion) =>
        $"Update trackarr to receive {pluginId} {version}: it requires plugin schema version {schemaVersion}, and this trackarr supports up to {SupportedPluginSchemaVersion}.";

    public const string PluginIdPattern = "^[a-z0-9]+(-[a-z0-9]+)*$";

    public static bool IsValidPluginId(string pluginId) => PluginIdRegex().IsMatch(pluginId);

    public static string GetInvalidPluginIdMessage(string pluginId) =>
        $"Plugin id '{pluginId}' is invalid. It must match {PluginIdPattern}: lowercase letters and digits, separated by single hyphens.";

    public static bool IsSemanticVersion(string version) => SemanticVersionRegex().IsMatch(version);

    // Semver 2.0 precedence; build metadata is ignored.
    public static int CompareVersions(string left, string right)
    {
        if (!IsSemanticVersion(left))
            throw new ArgumentException($"'{left}' is not a semantic version.", nameof(left));
        if (!IsSemanticVersion(right))
            throw new ArgumentException($"'{right}' is not a semantic version.", nameof(right));

        var (leftCore, leftPrerelease) = SplitVersion(left);
        var (rightCore, rightPrerelease) = SplitVersion(right);
        for (var index = 0; index < 3; index++)
        {
            var result = CompareNumeric(leftCore[index], rightCore[index]);
            if (result != 0)
                return result;
        }

        if (leftPrerelease is null || rightPrerelease is null)
            return (leftPrerelease is null ? 1 : 0) - (rightPrerelease is null ? 1 : 0);

        var leftIds = leftPrerelease.Split('.');
        var rightIds = rightPrerelease.Split('.');
        for (var index = 0; index < Math.Min(leftIds.Length, rightIds.Length); index++)
        {
            var leftNumeric = leftIds[index].All(char.IsAsciiDigit);
            var rightNumeric = rightIds[index].All(char.IsAsciiDigit);
            var result = (leftNumeric, rightNumeric) switch
            {
                (true, true) => CompareNumeric(leftIds[index], rightIds[index]),
                (true, false) => -1,
                (false, true) => 1,
                _ => string.CompareOrdinal(leftIds[index], rightIds[index])
            };
            if (result != 0)
                return Math.Sign(result);
        }

        return leftIds.Length.CompareTo(rightIds.Length);
    }

    private static (string[] Core, string? Prerelease) SplitVersion(string version)
    {
        var withoutBuild = version.Split('+', 2)[0];
        var parts = withoutBuild.Split('-', 2);
        return (parts[0].Split('.'), parts.Length > 1 ? parts[1] : null);
    }

    private static int CompareNumeric(string left, string right)
    {
        left = left.TrimStart('0');
        right = right.TrimStart('0');
        return left.Length != right.Length
            ? left.Length.CompareTo(right.Length)
            : Math.Sign(string.CompareOrdinal(left, right));
    }

    public static string? GetVersionViolation(
        PluginDefinition definition,
        bool requireSchemaVersion,
        bool requireVersion)
    {
        switch (GetCompatibility(definition.SchemaVersion))
        {
            case PluginSchemaCompatibility.Missing when requireSchemaVersion:
                return "Plugin definition is missing required field 'schemaVersion'.";
            case PluginSchemaCompatibility.Invalid:
                return "Property 'schemaVersion' must be a positive integer.";
            case PluginSchemaCompatibility.Incompatible:
                return GetIncompatibleMessage(definition.SchemaVersion!.Value);
        }

        if (string.IsNullOrWhiteSpace(definition.Version))
            return requireVersion ? "Plugin definition is missing required field 'version'." : null;

        return IsSemanticVersion(definition.Version)
            ? null
            : "Property 'version' must be a semantic version such as 1.2.0.";
    }

    // \z instead of $: $ also matches before a trailing newline.
    [GeneratedRegex(@"^[a-z0-9]+(-[a-z0-9]+)*\z")]
    private static partial Regex PluginIdRegex();

    [GeneratedRegex(@"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?\z")]
    private static partial Regex SemanticVersionRegex();
}
