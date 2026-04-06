using System.Text.Json;
using Hangfire;
using Hangfire.Server;
using Hangfire.Storage;
using Hangfire.Storage.Monitoring;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TrackerStats.Domain.Entities;
using TrackerStats.Domain.Plugins;
using TrackerStats.Domain.Plugins.Yaml;
using TrackerStats.Domain.Repositories;
using TrackerStats.Domain.Services;

namespace TrackerStats.Backend.Tests;

internal sealed class FakeTrackerPlugin(
    string pluginId,
    IReadOnlyList<PluginField>? fields = null,
    Action<HttpClient>? configureHttpClient = null,
    Func<HttpClient, CancellationToken, Task<TrackerFetchResult>>? fetch = null) : ITrackerPlugin
{
    public string PluginId { get; } = pluginId;
    public string DisplayName { get; } = pluginId;
    public DashboardConfig Dashboard { get; } = new()
    {
        Metrics =
        [
            new DashboardMetricDefinition
            {
                Stat = "ratio",
                Label = "Ratio"
            }
        ]
    };

    public AuthMode AuthMode => AuthMode.UsernamePassword;
    public IReadOnlyList<PluginField> Fields { get; } = fields ?? [];

    public void ConfigureHttpClient(HttpClient httpClient) => configureHttpClient?.Invoke(httpClient);

    public Task<TrackerFetchResult> FetchStatsAsync(HttpClient httpClient, CancellationToken ct) =>
        fetch is null
            ? Task.FromResult(new TrackerFetchResult(PluginProcessResult.Success))
            : fetch(httpClient, ct);
}

internal sealed class FakeTrackerPluginRegistry : ITrackerPluginRegistry
{
    private readonly Dictionary<string, ITrackerPlugin> _prototypes = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, Func<PluginConfiguration, ITrackerPlugin>> _factories = new(StringComparer.OrdinalIgnoreCase);

    public void Register(ITrackerPlugin plugin)
    {
        _prototypes[plugin.PluginId] = plugin;
        _factories[plugin.PluginId] = _ => plugin;
    }

    public void RegisterFactory(string pluginId, Func<PluginConfiguration, ITrackerPlugin> factory, ITrackerPlugin prototype)
    {
        _factories[pluginId] = factory;
        _prototypes[pluginId] = prototype;
    }

    public ITrackerPlugin? GetById(string pluginId) =>
        _prototypes.TryGetValue(pluginId, out var plugin) ? plugin : null;

    public ITrackerPlugin? CreateById(string pluginId, PluginConfiguration configuration) =>
        _factories.TryGetValue(pluginId, out var factory) ? factory(configuration) : null;

    public IReadOnlyList<ITrackerPlugin> GetAll() => _prototypes.Values.ToList();

    public IReadOnlyList<PluginCatalogEntry> GetCatalog() =>
        _prototypes.Values.Select(plugin => new PluginCatalogEntry(
            plugin.PluginId,
            plugin.DisplayName,
            plugin.Dashboard,
            plugin.Fields)).ToList();
}

internal sealed class InMemoryIntegrationRepository : IIntegrationRepository
{
    private readonly Dictionary<Guid, Integration> _items = new();

    public List<Integration> Added { get; } = [];
    public List<Integration> Updated { get; } = [];
    public List<Guid> Deleted { get; } = [];

    public Task<Integration> AddAsync(Integration integration, CancellationToken ct)
    {
        _items[integration.Id] = Clone(integration);
        Added.Add(Clone(integration));
        return Task.FromResult(integration);
    }

    public Task<IReadOnlyList<Integration>> ListAsync(CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<Integration>>(_items.Values.Select(Clone).ToList());

    public Task<Integration?> GetByIdAsync(Guid id, CancellationToken ct) =>
        Task.FromResult(_items.TryGetValue(id, out var integration) ? Clone(integration) : null);

    public Task<bool> ExistsByPluginIdAsync(string pluginId, CancellationToken ct) =>
        Task.FromResult(_items.Values.Any(item => string.Equals(item.PluginId, pluginId, StringComparison.OrdinalIgnoreCase)));

    public Task UpdateAsync(Integration integration, CancellationToken ct)
    {
        _items[integration.Id] = Clone(integration);
        Updated.Add(Clone(integration));
        return Task.CompletedTask;
    }

    public Task DeleteAsync(Guid id, CancellationToken ct)
    {
        _items.Remove(id);
        Deleted.Add(id);
        return Task.CompletedTask;
    }

    public void Seed(Integration integration) => _items[integration.Id] = Clone(integration);

    public Integration? Find(Guid id) => _items.TryGetValue(id, out var integration) ? Clone(integration) : null;

    private static Integration Clone(Integration integration)
    {
        return new Integration
        {
            Id = integration.Id,
            PluginId = integration.PluginId,
            Payload = integration.Payload,
            LastSyncAt = integration.LastSyncAt,
            LastSyncResult = integration.LastSyncResult,
            Ratio = integration.Ratio,
            UploadedBytes = integration.UploadedBytes,
            DownloadedBytes = integration.DownloadedBytes,
            SeedBonus = integration.SeedBonus,
            Buffer = integration.Buffer,
            HitAndRuns = integration.HitAndRuns,
            RequiredRatio = integration.RequiredRatio,
            SeedingTorrents = integration.SeedingTorrents,
            LeechingTorrents = integration.LeechingTorrents,
            ActiveTorrents = integration.ActiveTorrents
        };
    }
}

internal sealed class InMemoryIntegrationSnapshotRepository : IIntegrationSnapshotRepository
{
    private readonly List<IntegrationSnapshot> _items = [];

    public List<IntegrationSnapshot> Added { get; } = [];

    public Task AddAsync(IntegrationSnapshot snapshot, CancellationToken ct)
    {
        _items.Add(Clone(snapshot));
        Added.Add(Clone(snapshot));
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<IntegrationSnapshot>> ListByIntegrationAsync(Guid integrationId, DateTime? from, DateTime? to, CancellationToken ct)
    {
        var items = _items
            .Where(item => item.IntegrationId == integrationId)
            .Where(item => !from.HasValue || item.CapturedAt >= from.Value)
            .Where(item => !to.HasValue || item.CapturedAt <= to.Value)
            .Select(Clone)
            .ToList();

        return Task.FromResult<IReadOnlyList<IntegrationSnapshot>>(items);
    }

    public void Seed(IntegrationSnapshot snapshot) => _items.Add(Clone(snapshot));

    private static IntegrationSnapshot Clone(IntegrationSnapshot snapshot)
    {
        return new IntegrationSnapshot
        {
            Id = snapshot.Id,
            IntegrationId = snapshot.IntegrationId,
            CapturedAt = snapshot.CapturedAt,
            Ratio = snapshot.Ratio,
            UploadedBytes = snapshot.UploadedBytes,
            DownloadedBytes = snapshot.DownloadedBytes,
            SeedBonus = snapshot.SeedBonus,
            Buffer = snapshot.Buffer,
            HitAndRuns = snapshot.HitAndRuns,
            RequiredRatio = snapshot.RequiredRatio,
            SeedingTorrents = snapshot.SeedingTorrents,
            LeechingTorrents = snapshot.LeechingTorrents,
            ActiveTorrents = snapshot.ActiveTorrents
        };
    }
}

internal sealed class FakeTrackerPluginHttpClientFactory : ITrackerPluginHttpClientFactory
{
    public HttpClient CreateClient(ITrackerPlugin plugin)
    {
        var client = new HttpClient();
        plugin.ConfigureHttpClient(client);
        return client;
    }
}

internal sealed class FakeHttpClientFactory : IHttpClientFactory
{
    public HttpClient CreateClient(string name) => new();
}

internal sealed class FakeTimeProvider(DateTimeOffset utcNow) : TimeProvider
{
    private readonly DateTimeOffset _utcNow = utcNow;

    public override DateTimeOffset GetUtcNow() => _utcNow;
}

internal sealed class FakeRecurringJobManager : IRecurringJobManager
{
    public List<(string JobId, string Cron)> AddOrUpdates { get; } = [];
    public List<string> RemovedJobIds { get; } = [];

    public void AddOrUpdate(string recurringJobId, Hangfire.Common.Job job, string cronExpression, RecurringJobOptions options) =>
        AddOrUpdates.Add((recurringJobId, cronExpression));

    public void Trigger(string recurringJobId)
    {
    }

    public void RemoveIfExists(string recurringJobId) => RemovedJobIds.Add(recurringJobId);
}

internal sealed class FakeJobStorage : JobStorage
{
    private readonly IStorageConnection _connection;

    public FakeJobStorage(IStorageConnection connection)
    {
        _connection = connection;
    }

    public override IMonitoringApi GetMonitoringApi() => throw new NotSupportedException();

    public override IStorageConnection GetConnection() => _connection;
}

internal sealed class FakeStorageConnection : IStorageConnection
{
    private readonly Dictionary<string, DateTime?> _recurringJobs;

    public FakeStorageConnection(IEnumerable<string>? recurringJobIds = null)
    {
        _recurringJobs = recurringJobIds is null
            ? new Dictionary<string, DateTime?>(StringComparer.Ordinal)
            : recurringJobIds.ToDictionary(id => id, _ => (DateTime?)null, StringComparer.Ordinal);
    }

    public FakeStorageConnection(IReadOnlyDictionary<string, DateTime?> recurringJobs)
    {
        _recurringJobs = new Dictionary<string, DateTime?>(recurringJobs, StringComparer.Ordinal);
    }

    public void Dispose()
    {
    }

    public IWriteOnlyTransaction CreateWriteTransaction() => throw new NotSupportedException();
    public IDisposable AcquireDistributedLock(string resource, TimeSpan timeout) => throw new NotSupportedException();
    public string CreateExpiredJob(Hangfire.Common.Job job, IDictionary<string, string> parameters, DateTime createdAt, TimeSpan expireIn) => throw new NotSupportedException();
    public IFetchedJob FetchNextJob(string[] queues, CancellationToken cancellationToken) => throw new NotSupportedException();
    public void SetJobParameter(string id, string name, string value) => throw new NotSupportedException();
    public string? GetJobParameter(string id, string name) => throw new NotSupportedException();
    public JobData GetJobData(string jobId) => throw new NotSupportedException();
    public StateData GetStateData(string jobId) => throw new NotSupportedException();
    public void AnnounceServer(string serverId, ServerContext context) => throw new NotSupportedException();
    public void RemoveServer(string serverId) => throw new NotSupportedException();
    public void Heartbeat(string serverId) => throw new NotSupportedException();
    public int RemoveTimedOutServers(TimeSpan timeOut) => throw new NotSupportedException();

    public HashSet<string> GetAllItemsFromSet(string key) =>
        key == "recurring-jobs" ? [.. _recurringJobs.Keys] : [];

    public string? GetFirstByLowestScoreFromSet(string key, double fromScore, double toScore) => throw new NotSupportedException();

    public void SetRangeInHash(string key, IEnumerable<KeyValuePair<string, string>> keyValuePairs) => throw new NotSupportedException();

    public Dictionary<string, string> GetAllEntriesFromHash(string key)
    {
        const string recurringPrefix = "recurring-job:";

        if (!key.StartsWith(recurringPrefix, StringComparison.Ordinal))
            return [];

        var jobId = key[recurringPrefix.Length..];
        if (!_recurringJobs.TryGetValue(jobId, out var nextExecution))
            return [];

        var hash = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["Cron"] = "0 * * * *",
            ["TimeZoneId"] = TimeZoneInfo.Utc.Id
        };

        if (nextExecution.HasValue)
            hash["NextExecution"] = nextExecution.Value.ToString("o");

        return hash;
    }
}

internal sealed class FakeYamlPluginDefinitionLoader(IReadOnlyList<LoadedYamlPluginDefinition> definitions) : IYamlPluginDefinitionLoader
{
    public IReadOnlyList<LoadedYamlPluginDefinition> LoadDefinitions() => definitions;
}

internal sealed class FakeApplicationSettingsService(string userAgent = "test-user-agent") : IApplicationSettingsService
{
    private string _userAgent = userAgent;

    public ApplicationSettingsSnapshot GetRequired() => new(_userAgent);

    public Task<ApplicationSettingsSnapshot> UpdateUserAgentAsync(string userAgent, CancellationToken ct)
    {
        _userAgent = userAgent.Trim();
        return Task.FromResult(new ApplicationSettingsSnapshot(_userAgent));
    }
}

internal sealed class FakeAboutService(string databaseEngine = "SQLite") : IAboutService
{
    public AboutSnapshot Get() => new(
        "1.0.0-test",
        "10.0.0",
        false,
        databaseEngine,
        3,
        "/data",
        "/app",
        "Development",
        "01:23:45");
}

internal sealed class FakeHostEnvironment(string contentRootPath) : IHostEnvironment
{
    public string EnvironmentName { get; set; } = Environments.Development;
    public string ApplicationName { get; set; } = "TrackerStats.Tests";
    public string ContentRootPath { get; set; } = contentRootPath;
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
}

internal sealed class ListLogger<T> : ILogger<T>
{
    public List<(LogLevel Level, string Message)> Entries { get; } = [];

    public IDisposable BeginScope<TState>(TState state) where TState : notnull => NullScope.Instance;

    public bool IsEnabled(LogLevel logLevel) => true;

    public void Log<TState>(
        LogLevel logLevel,
        EventId eventId,
        TState state,
        Exception? exception,
        Func<TState, Exception?, string> formatter)
    {
        Entries.Add((logLevel, formatter(state, exception)));
    }

    private sealed class NullScope : IDisposable
    {
        public static readonly NullScope Instance = new();

        public void Dispose()
        {
        }
    }
}

internal static class TestHttp
{
    public static void SetYamlBody(ControllerBase controller, string yaml)
    {
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };

        controller.ControllerContext.HttpContext.Request.Body = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(yaml));
    }

    public static JsonElement ToJson(object? value) =>
        JsonSerializer.SerializeToElement(value, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });
}
