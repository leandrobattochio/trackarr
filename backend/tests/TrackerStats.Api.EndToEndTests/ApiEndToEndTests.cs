using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Shouldly;
using Testcontainers.PostgreSql;

namespace TrackerStats.Api.EndToEndTests;

public sealed class ApiEndToEndTests : IClassFixture<ApiEndToEndFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly ApiEndToEndFactory _factory;

    public ApiEndToEndTests(ApiEndToEndFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Get_plugins_should_load_definitions_from_disk()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/plugins");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var plugins = await response.Content.ReadFromJsonAsync<List<PluginResponse>>(JsonOptions);
        plugins.ShouldNotBeNull();
        plugins.ShouldContain(plugin => plugin.PluginId == "seedpool" && plugin.DefinitionValid);
        plugins.ShouldContain(plugin => plugin.PluginId == "asc");
    }

    [Fact]
    public async Task Create_and_list_integrations_should_persist_in_postgres()
    {
        using var client = _factory.CreateClient();
        var payload = JsonSerializer.Serialize(new Dictionary<string, string>
        {
            ["baseUrl"] = "https://seedpool.org/",
            ["apiKey"] = "integration-api-key",
            ["required_ratio"] = "1.50",
            ["cron"] = "0 * * * *"
        });

        var createResponse = await client.PostAsJsonAsync("/api/integrations", new
        {
            pluginId = "seedpool",
            payload
        });

        createResponse.StatusCode.ShouldBe(HttpStatusCode.Created);
        var created = await createResponse.Content.ReadFromJsonAsync<IntegrationResponse>(JsonOptions);
        created.ShouldNotBeNull();
        created.PluginId.ShouldBe("seedpool");
        created.RequiredRatio.ShouldBe(1.5m);
        created.Payload.ShouldContainKey("baseUrl");
        created.Payload.ShouldNotContainKey("apiKey");

        var listResponse = await client.GetAsync("/api/integrations");

        listResponse.StatusCode.ShouldBe(HttpStatusCode.OK);
        var integrations = await listResponse.Content.ReadFromJsonAsync<List<IntegrationResponse>>(JsonOptions);
        integrations.ShouldNotBeNull();
        var persisted = integrations.FirstOrDefault(integration => integration.Id == created.Id);
        persisted.ShouldNotBeNull();
        persisted.Payload["baseUrl"].ShouldBe("https://seedpool.org/");
        persisted.Payload.ShouldNotContainKey("apiKey");
        persisted.ConfigurationValid.ShouldBeTrue();
    }

    [Fact]
    public async Task Whats_new_should_store_its_read_state_in_a_fresh_database()
    {
        using var client = _factory.CreateClient();

        var before = await client.GetFromJsonAsync<JsonElement>("/api/whats-new", JsonOptions);

        before.GetProperty("lastReadAt").ValueKind.ShouldBe(JsonValueKind.Null);
        before.GetProperty("lastReadPluginChangeId").ValueKind.ShouldBe(JsonValueKind.Null);
        before.GetProperty("app").GetProperty("status").GetString().ShouldBe("unavailable");
        before.GetProperty("pluginUpdates").GetArrayLength().ShouldBe(0);

        (await client.PostAsync("/api/whats-new/read", null)).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var after = await client.GetFromJsonAsync<JsonElement>("/api/whats-new", JsonOptions);
        after.GetProperty("shouldAutoOpen").GetBoolean().ShouldBeFalse();
        after.GetProperty("lastReadAt").ValueKind.ShouldBe(JsonValueKind.String);
        after.GetProperty("lastReadPluginChangeId").GetInt64().ShouldBe(0);
    }

    public sealed class PluginResponse
    {
        public string PluginId { get; init; } = string.Empty;
        public bool DefinitionValid { get; init; }
    }

    public sealed class IntegrationResponse
    {
        public Guid Id { get; init; }
        public string PluginId { get; init; } = string.Empty;
        public decimal? RequiredRatio { get; init; }
        public bool ConfigurationValid { get; init; }
        public Dictionary<string, string?> Payload { get; init; } = [];
    }
}

public sealed class ApiEndToEndFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private const string PostgresConnectionEnvVar = "ConnectionStrings__PostgresConnection";
    private const string HangfireConnectionEnvVar = "ConnectionStrings__HangfireConnection";
    private const string DataDirectoryEnvVar = "Data__Directory";
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:17-alpine")
        .WithDatabase("trackerstats")
        .WithUsername("postgres")
        .WithPassword("postgres")
        .Build();

    private readonly string _dataDirectory = Path.Combine(Path.GetTempPath(), $"trackerstats-e2e-{Guid.NewGuid():N}");

    public async Task InitializeAsync()
    {
        Directory.CreateDirectory(_dataDirectory);

        RepoPlugins.CopyToOfficial(_dataDirectory);
        var hangfireConnection = $"Data Source={Path.Combine(_dataDirectory, "hangfire-e2e.db")}";

        await _postgres.StartAsync();

        Environment.SetEnvironmentVariable(PostgresConnectionEnvVar, _postgres.GetConnectionString());
        Environment.SetEnvironmentVariable(HangfireConnectionEnvVar, hangfireConnection);
        Environment.SetEnvironmentVariable(DataDirectoryEnvVar, _dataDirectory);
        Environment.SetEnvironmentVariable(RepoPlugins.SourceUrlEnvVar, RepoPlugins.OfflineSourceUrl(_dataDirectory));
        Environment.SetEnvironmentVariable(RepoPlugins.AppReleasesUrlEnvVar, RepoPlugins.OfflineAppReleasesUrl);
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        base.Dispose();
        Environment.SetEnvironmentVariable(PostgresConnectionEnvVar, null);
        Environment.SetEnvironmentVariable(HangfireConnectionEnvVar, null);
        Environment.SetEnvironmentVariable(DataDirectoryEnvVar, null);
        Environment.SetEnvironmentVariable(RepoPlugins.SourceUrlEnvVar, null);
        Environment.SetEnvironmentVariable(RepoPlugins.AppReleasesUrlEnvVar, null);
        await _postgres.DisposeAsync();

        if (Directory.Exists(_dataDirectory))
            Directory.Delete(_dataDirectory, recursive: true);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureAppConfiguration((_, _) => { });
    }
}
