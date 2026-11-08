using System.Globalization;
using System.Text;
using TrackerStats.Domain.Entities;
using TrackerStats.Domain.Plugins;
using TrackerStats.Domain.Repositories;
using TrackerStats.Infrastructure.Releases;
using TrackerStats.PluginEngine;

namespace TrackerStats.Api.Metrics;

public sealed class TrackerMetricsWriter(
    IIntegrationRepository integrationRepository,
    ITrackerPluginRegistry pluginRegistry,
    InstalledAppVersion appVersion)
{
    public const string ContentType = "text/plain; version=0.0.4; charset=utf-8";

    private static readonly TrackerGauge[] Gauges =
    [
        new("ratio", "Ratio at the last successful sync.", i => i.Ratio),
        new("required_ratio", "Minimum ratio the tracker requires.", i => i.RequiredRatio),
        new("uploaded_bytes", "Uploaded bytes at the last successful sync.", i => i.UploadedBytes),
        new("downloaded_bytes", "Downloaded bytes at the last successful sync.", i => i.DownloadedBytes),
        new("buffer_bytes", "Buffer in bytes at the last successful sync. Negative when the account owes upload.", i => TryParse(i.Buffer, v => NumericParser.ParseByteSize(v))),
        new("seed_bonus", "Seed bonus points at the last successful sync.", i => TryParse(i.SeedBonus, NumericParser.ParseDecimal)),
        new("hit_and_runs", "Hit and runs at the last successful sync.", i => i.HitAndRuns),
        new("seeding_torrents", "Torrents seeding at the last successful sync.", i => i.SeedingTorrents),
        new("leeching_torrents", "Torrents leeching at the last successful sync.", i => i.LeechingTorrents),
        new("active_torrents", "Active torrents at the last successful sync.", i => i.ActiveTorrents),
        new("last_sync_timestamp_seconds", "Unix time of the last sync, successful or not.", i => ToUnixSeconds(i.LastSyncAt))
    ];

    public async Task<string> WriteAsync(CancellationToken ct)
    {
        var integrations = await integrationRepository.ListAsync(ct);
        var trackers = integrations
            .Select(integration => (Integration: integration, Labels: LabelsFor(integration)))
            .OrderBy(tracker => tracker.Integration.PluginId, StringComparer.Ordinal)
            .ToList();

        var output = new StringBuilder();

        WriteHeader(output, "trackarr_info", "Version of trackarr.");
        output.Append("trackarr_info{version=\"").Append(Escape(appVersion.Value)).Append("\"} 1\n");

        WriteHeader(output, "trackarr_trackers", "Trackers registered in trackarr.");
        output.Append("trackarr_trackers ").Append(trackers.Count.ToString(CultureInfo.InvariantCulture)).Append('\n');

        foreach (var gauge in Gauges)
        {
            var name = $"trackarr_tracker_{gauge.Name}";
            WriteHeader(output, name, gauge.Help);
            foreach (var (integration, labels) in trackers)
            {
                var value = gauge.Value(integration);
                if (value is null)
                    continue;

                output.Append(name).Append('{').Append(labels).Append("} ")
                    .Append(value.Value.ToString(CultureInfo.InvariantCulture)).Append('\n');
            }
        }

        const string resultName = "trackarr_tracker_last_sync_result";
        WriteHeader(output, resultName, "Result of the last sync: success, authFailed or unknownError. Always 1. Stats keep the values of the last successful sync while it is not success.");
        foreach (var (integration, labels) in trackers)
        {
            if (integration.LastSyncResult is not { } result)
                continue;

            output.Append(resultName).Append('{').Append(labels)
                .Append(",result=\"").Append(SyncResultNames.From(result)).Append("\"} 1\n");
        }

        return output.ToString();
    }

    private string LabelsFor(Integration integration)
    {
        var tracker = pluginRegistry.GetById(integration.PluginId)?.DisplayName ?? integration.PluginId;
        return $"tracker=\"{Escape(tracker)}\",plugin=\"{Escape(integration.PluginId)}\"";
    }

    private static void WriteHeader(StringBuilder output, string name, string help) =>
        output.Append("# HELP ").Append(name).Append(' ').Append(help).Append('\n')
            .Append("# TYPE ").Append(name).Append(" gauge\n");

    private static string Escape(string value) =>
        value.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n");

    private static decimal? ToUnixSeconds(DateTime? value) =>
        value is { } at
            ? new DateTimeOffset(DateTime.SpecifyKind(at, DateTimeKind.Utc)).ToUnixTimeSeconds()
            : null;

    private static decimal? TryParse(string? value, Func<string, decimal> parse)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        try
        {
            return parse(value);
        }
        catch (Exception exception) when (exception is InvalidOperationException or OverflowException)
        {
            return null;
        }
    }

    private sealed record TrackerGauge(string Name, string Help, Func<Integration, decimal?> Value);
}
