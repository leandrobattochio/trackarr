using Microsoft.AspNetCore.Mvc;
using Shouldly;
using TrackerStats.Api.Controllers;
using TrackerStats.Api.Metrics;
using TrackerStats.Domain.Entities;
using TrackerStats.Domain.Plugins;
using TrackerStats.Infrastructure.Releases;

namespace TrackerStats.Backend.Tests;

public class TrackerMetricsWriterTests
{
    [Fact]
    public async Task WriteAsync_should_write_every_stat_of_a_synced_tracker()
    {
        var repository = new InMemoryIntegrationRepository();
        repository.Seed(new Integration
        {
            Id = Guid.NewGuid(),
            PluginId = "capybarabr",
            Payload = "{}",
            LastSyncAt = new DateTime(2026, 11, 8, 12, 0, 0, DateTimeKind.Utc),
            LastSyncResult = PluginProcessResult.Success,
            Ratio = 39.64m,
            RequiredRatio = 1m,
            UploadedBytes = 1_319_413_953_331,
            DownloadedBytes = 33_285_996_544,
            Buffer = "1.17 TiB",
            SeedBonus = "84500.25",
            HitAndRuns = 0,
            SeedingTorrents = 41,
            LeechingTorrents = 1,
            ActiveTorrents = 42
        });

        var output = await CreateWriter(repository).WriteAsync(CancellationToken.None);

        const string labels = "{tracker=\"capybarabr\",plugin=\"capybarabr\"}";
        output.ShouldContain($"trackarr_tracker_ratio{labels} 39.64\n");
        output.ShouldContain($"trackarr_tracker_required_ratio{labels} 1\n");
        output.ShouldContain($"trackarr_tracker_uploaded_bytes{labels} 1319413953331\n");
        output.ShouldContain($"trackarr_tracker_downloaded_bytes{labels} 33285996544\n");
        output.ShouldContain($"trackarr_tracker_buffer_bytes{labels} 1286428604498\n");
        output.ShouldContain($"trackarr_tracker_seed_bonus{labels} 84500.25\n");
        output.ShouldContain($"trackarr_tracker_hit_and_runs{labels} 0\n");
        output.ShouldContain($"trackarr_tracker_seeding_torrents{labels} 41\n");
        output.ShouldContain($"trackarr_tracker_leeching_torrents{labels} 1\n");
        output.ShouldContain($"trackarr_tracker_active_torrents{labels} 42\n");
        output.ShouldContain($"trackarr_tracker_last_sync_timestamp_seconds{labels} 1794139200\n");
        output.ShouldContain("trackarr_tracker_last_sync_result{tracker=\"capybarabr\",plugin=\"capybarabr\",result=\"success\"} 1\n");
    }

    [Fact]
    public async Task WriteAsync_should_leave_out_stats_the_tracker_did_not_report()
    {
        var repository = new InMemoryIntegrationRepository();
        repository.Seed(new Integration { Id = Guid.NewGuid(), PluginId = "asc", Payload = "{}" });

        var output = await CreateWriter(repository).WriteAsync(CancellationToken.None);

        output.ShouldContain("trackarr_trackers 1\n");
        output.ShouldNotContain("plugin=\"asc\"");
        output.ShouldContain("# TYPE trackarr_tracker_ratio gauge\n");
    }

    [Fact]
    public async Task WriteAsync_should_report_a_failed_sync_with_its_result()
    {
        var repository = new InMemoryIntegrationRepository();
        repository.Seed(new Integration
        {
            Id = Guid.NewGuid(),
            PluginId = "capybarabr",
            Payload = "{}",
            LastSyncAt = new DateTime(2026, 11, 8, 12, 0, 0, DateTimeKind.Utc),
            LastSyncResult = PluginProcessResult.AuthFailed
        });

        var output = await CreateWriter(repository).WriteAsync(CancellationToken.None);

        output.ShouldContain("trackarr_tracker_last_sync_result{tracker=\"capybarabr\",plugin=\"capybarabr\",result=\"authFailed\"} 1\n");
        output.ShouldContain("trackarr_tracker_last_sync_timestamp_seconds{tracker=\"capybarabr\",plugin=\"capybarabr\"} 1794139200\n");
    }

    [Theory]
    [InlineData("-21 GiB", "-22548578304")]
    [InlineData("512 MB", "512000000")]
    public async Task WriteAsync_should_convert_the_buffer_to_bytes(string buffer, string expected)
    {
        var output = await WriteSingle(new Integration { Buffer = buffer });

        output.ShouldContain($"trackarr_tracker_buffer_bytes{{{SeedpoolLabels}}} {expected}\n");
    }

    [Theory]
    [InlineData("84.500,75", "84500.75")]
    [InlineData("84,500.25", "84500.25")]
    [InlineData("1,5K", "1500.0")]
    public async Task WriteAsync_should_convert_the_seed_bonus_to_a_number(string seedBonus, string expected)
    {
        var output = await WriteSingle(new Integration { SeedBonus = seedBonus });

        output.ShouldContain($"trackarr_tracker_seed_bonus{{{SeedpoolLabels}}} {expected}\n");
    }

    [Theory]
    [InlineData("n/a")]
    [InlineData("∞")]
    [InlineData("99999999999 PiB")]
    public async Task WriteAsync_should_skip_a_seed_bonus_or_buffer_that_is_not_a_number(string value)
    {
        var output = await WriteSingle(new Integration { SeedBonus = value, Buffer = value });

        output.ShouldNotContain("trackarr_tracker_seed_bonus{");
        output.ShouldNotContain("trackarr_tracker_buffer_bytes{");
    }

    [Fact]
    public async Task WriteAsync_should_use_the_plugin_display_name_and_escape_labels()
    {
        var repository = new InMemoryIntegrationRepository();
        repository.Seed(new Integration { Id = Guid.NewGuid(), PluginId = "odd", Payload = "{}", HitAndRuns = 2 });
        var registry = new FakeTrackerPluginRegistry();
        registry.Register(new NamedPlugin("odd", "Odd \"Tracker\"\\BR"));

        var output = await new TrackerMetricsWriter(repository, registry, new InstalledAppVersion("1.2.3"))
            .WriteAsync(CancellationToken.None);

        output.ShouldContain("trackarr_tracker_hit_and_runs{tracker=\"Odd \\\"Tracker\\\"\\\\BR\",plugin=\"odd\"} 2\n");
    }

    [Fact]
    public async Task WriteAsync_should_write_the_app_version_and_the_tracker_count()
    {
        var output = await CreateWriter(new InMemoryIntegrationRepository()).WriteAsync(CancellationToken.None);

        output.ShouldContain("trackarr_info{version=\"1.2.3\"} 1\n");
        output.ShouldContain("trackarr_trackers 0\n");
    }

    [Fact]
    public async Task Controller_should_return_the_prometheus_text_format()
    {
        var controller = new MetricsController(CreateWriter(new InMemoryIntegrationRepository()));

        var result = await controller.Get(CancellationToken.None);

        var content = result.ShouldBeOfType<ContentResult>();
        content.ContentType.ShouldBe("text/plain; version=0.0.4; charset=utf-8");
        content.Content.ShouldNotBeNull().ShouldStartWith("# HELP trackarr_info");
    }

    private const string SeedpoolLabels = "tracker=\"seedpool\",plugin=\"seedpool\"";

    private static async Task<string> WriteSingle(Integration integration)
    {
        integration.Id = Guid.NewGuid();
        integration.PluginId = "seedpool";
        integration.Payload = "{}";
        var repository = new InMemoryIntegrationRepository();
        repository.Seed(integration);
        return await CreateWriter(repository).WriteAsync(CancellationToken.None);
    }

    private static TrackerMetricsWriter CreateWriter(InMemoryIntegrationRepository repository)
    {
        var registry = new FakeTrackerPluginRegistry();
        foreach (var pluginId in new[] { "capybarabr", "seedpool", "asc" })
            registry.Register(new FakeTrackerPlugin(pluginId));
        return new TrackerMetricsWriter(repository, registry, new InstalledAppVersion("1.2.3"));
    }

    private sealed class NamedPlugin(string pluginId, string displayName) : ITrackerPlugin
    {
        public string PluginId { get; } = pluginId;
        public string DisplayName { get; } = displayName;
        public DashboardConfig Dashboard { get; } = new();
        public AuthMode AuthMode => AuthMode.UsernamePassword;
        public IReadOnlyList<string> BaseUrls { get; } = [];
        public IReadOnlyList<PluginField> Fields { get; } = [];
        public void ConfigureHttpClient(HttpClient httpClient) { }
        public Task<TrackerFetchResult> FetchStatsAsync(HttpClient httpClient, CancellationToken ct) =>
            Task.FromResult(new TrackerFetchResult(PluginProcessResult.Success));
    }
}
