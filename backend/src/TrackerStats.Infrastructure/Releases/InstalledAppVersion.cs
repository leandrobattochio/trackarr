using System.Reflection;

namespace TrackerStats.Infrastructure.Releases;

public sealed record InstalledAppVersion(string Value)
{
    public static InstalledAppVersion FromEntryAssembly()
    {
        var entryAssembly = Assembly.GetEntryAssembly();
        var version = entryAssembly?.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion
            ?? entryAssembly?.GetName().Version?.ToString()
            ?? "Unknown";
        return new InstalledAppVersion(version);
    }

    // "v0.4.0+abc123" -> "0.4.0": tags carry a "v" and the SDK appends the commit as build metadata.
    public static string Normalize(string version)
    {
        var trimmed = version.Trim();
        if (trimmed.StartsWith('v') || trimmed.StartsWith('V'))
            trimmed = trimmed[1..];
        return trimmed.Split('+', 2)[0];
    }
}
