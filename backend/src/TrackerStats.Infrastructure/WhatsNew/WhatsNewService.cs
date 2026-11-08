using Microsoft.EntityFrameworkCore;
using TrackerStats.Domain.Entities;
using TrackerStats.Domain.Plugins.Yaml;
using TrackerStats.Infrastructure.Data;
using TrackerStats.Infrastructure.Plugins.Storage;
using TrackerStats.Infrastructure.Releases;

namespace TrackerStats.Infrastructure.WhatsNew;

public sealed record WhatsNewReport(
    bool ShouldAutoOpen,
    string? LastReadAppVersion,
    long? LastReadPluginChangeId,
    DateTime? LastReadAt,
    AppReleaseReport App,
    IReadOnlyList<PluginUpdateRecord> PluginUpdates);

public sealed class WhatsNewService(
    AppDbContext db,
    AppReleaseService releaseService,
    PluginStateStore stateStore)
{
    // CHANGELOG.md starts at 0.4.0; older GitHub releases carry no release notes.
    public const string FirstChangelogVersion = "0.4.0";

    public async Task<WhatsNewReport> GetAsync(CancellationToken cancellationToken = default)
    {
        var read = await LoadAsync(cancellationToken);
        var app = await releaseService.GetReportAsync(read.LastReadAppVersion, cancellationToken);
        app = app with
        {
            Releases = app.Releases
                .Where(release => PluginSchema.CompareVersions(release.Version, FirstChangelogVersion) >= 0)
                .ToList()
        };

        var state = stateStore.Load();
        var lastReadChangeId = GetLastReadChangeId(read, state.LastUpdateId);
        var pluginUpdates = state.Updates
            .Where(update => update.Id > lastReadChangeId)
            .OrderByDescending(update => update.Id)
            .ToList();

        var shouldAutoOpen = IsAppUnread(releaseService.InstalledVersion, read.LastReadAppVersion) || pluginUpdates.Count > 0;
        return new WhatsNewReport(
            shouldAutoOpen,
            read.LastReadAppVersion,
            read.LastReadPluginChangeId,
            read.LastReadAt,
            app,
            pluginUpdates);
    }

    /// <param name="seenPluginChangeId">Newest plugin update the reader was shown; null marks every update read.</param>
    public async Task MarkReadAsync(long? seenPluginChangeId = null, CancellationToken cancellationToken = default)
    {
        var read = await LoadAsync(cancellationToken);
        var installed = releaseService.InstalledVersion;
        if (IsAppUnread(installed, read.LastReadAppVersion))
            read.LastReadAppVersion = installed;
        var lastUpdateId = stateStore.Load().LastUpdateId;
        read.LastReadPluginChangeId = seenPluginChangeId is { } seen
            ? Math.Max(GetLastReadChangeId(read, lastUpdateId), Math.Min(seen, lastUpdateId))
            : lastUpdateId;
        read.LastReadAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }

    // A stored id above the last issued one means state.json was reset, so its ids start over.
    private static long GetLastReadChangeId(WhatsNewState read, long lastUpdateId) =>
        read.LastReadPluginChangeId is { } id && id <= lastUpdateId ? id : 0;

    // A non-semver installed version, such as a local build, never counts as an update.
    private static bool IsAppUnread(string installed, string? lastRead) =>
        PluginSchema.IsSemanticVersion(installed)
        && (lastRead is null || !PluginSchema.IsSemanticVersion(lastRead) || PluginSchema.CompareVersions(installed, lastRead) > 0);

    private async Task<WhatsNewState> LoadAsync(CancellationToken cancellationToken)
    {
        var read = await db.WhatsNewStates.SingleOrDefaultAsync(state => state.Id == WhatsNewState.SingletonId, cancellationToken);
        if (read is not null)
            return read;

        read = new WhatsNewState { Id = WhatsNewState.SingletonId };
        db.WhatsNewStates.Add(read);
        return read;
    }
}
