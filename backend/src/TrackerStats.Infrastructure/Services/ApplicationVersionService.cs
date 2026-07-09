using System.Reflection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using TrackerStats.Domain.Services;

namespace TrackerStats.Infrastructure.Services;

public sealed class ApplicationVersionService(
    IHostEnvironment hostEnvironment,
    IConfiguration configuration) : IApplicationVersionService
{
    private const string DefaultDevelopmentVersion = "0.0.1";

    public string GetVersion()
    {
        if (hostEnvironment.IsDevelopment())
            return string.IsNullOrWhiteSpace(configuration["Version:DevelopmentVersion"])
                ? DefaultDevelopmentVersion
                : configuration["Version:DevelopmentVersion"]!.Trim();

        var entryAssembly = Assembly.GetEntryAssembly();
        var informationalVersion = entryAssembly?
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?
            .InformationalVersion;

        return informationalVersion
            ?? entryAssembly?.GetName().Version?.ToString()
            ?? "Unknown";
    }
}
