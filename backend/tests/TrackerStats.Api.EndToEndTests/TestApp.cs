using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace TrackerStats.Api.EndToEndTests;

internal static class TestApp
{
    public const string PostgresConnectionEnvVar = "ConnectionStrings__PostgresConnection";
    public const string HangfireConnectionEnvVar = "ConnectionStrings__HangfireConnection";
    public const string DataDirectoryEnvVar = "Data__Directory";

    // Program reads its configuration before Build(), so settings go through process environment variables.
    public static Dictionary<string, string?> Variables(string dataDirectory, string? postgresConnection) => new()
    {
        [PostgresConnectionEnvVar] = postgresConnection,
        [HangfireConnectionEnvVar] = $"Data Source={Path.Combine(dataDirectory, "hangfire-e2e.db")}",
        [DataDirectoryEnvVar] = dataDirectory,
        [RepoPlugins.SourceUrlEnvVar] = RepoPlugins.OfflineSourceUrl(dataDirectory),
        [RepoPlugins.AppReleasesUrlEnvVar] = RepoPlugins.OfflineAppReleasesUrl
    };

    public static void Apply(IReadOnlyDictionary<string, string?> variables)
    {
        foreach (var (name, value) in variables)
            Environment.SetEnvironmentVariable(name, value);
    }

    public static void Clear(IEnumerable<string> names)
    {
        foreach (var name in names)
            Environment.SetEnvironmentVariable(name, null);
    }

    public static async Task BootAsync(
        string dataDirectory,
        string? postgresConnection,
        Func<WebApplicationFactory<Program>, HttpClient, Task> act,
        LogCollector? logs = null,
        Action<IServiceCollection>? configureServices = null)
    {
        var variables = Variables(dataDirectory, postgresConnection);
        Apply(variables);
        try
        {
            await using var factory = new Factory(logs, configureServices);
            using var client = factory.CreateClient();
            await act(factory, client);
        }
        finally
        {
            Clear(variables.Keys);
        }
    }

    private sealed class Factory(LogCollector? logs, Action<IServiceCollection>? configureServices)
        : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            if (logs is not null)
                builder.ConfigureLogging(logging => logging.AddProvider(logs));
            if (configureServices is not null)
                builder.ConfigureTestServices(configureServices);
        }
    }
}
