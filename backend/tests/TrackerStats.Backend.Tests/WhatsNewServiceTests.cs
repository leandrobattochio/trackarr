using System.Net;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;
using TrackerStats.Api.Controllers;
using TrackerStats.Infrastructure.Data;
using TrackerStats.Infrastructure.Plugins.Source;
using TrackerStats.Infrastructure.Plugins.Storage;
using TrackerStats.Infrastructure.Releases;
using TrackerStats.Infrastructure.WhatsNew;

namespace TrackerStats.Backend.Tests;

public sealed class WhatsNewServiceTests : IDisposable
{
    private const string ReleasesJson = """
        [
          { "tag_name": "v0.5.0", "name": "v0.5.0", "body": "0.5.0 notes", "draft": false, "prerelease": false, "published_at": "2026-12-01T10:00:00Z" },
          { "tag_name": "v0.4.1", "name": "v0.4.1", "body": "0.4.1 notes", "draft": false, "prerelease": false, "published_at": "2026-11-20T10:00:00Z" },
          { "tag_name": "v0.4.0", "name": "v0.4.0", "body": "0.4.0 notes", "draft": false, "prerelease": false, "published_at": "2026-11-10T10:00:00Z" },
          { "tag_name": "v0.3.2", "name": "v0.3.2", "body": "old free text", "draft": false, "prerelease": false, "published_at": "2026-10-01T10:00:00Z" }
        ]
        """;

    private readonly string _dataDirectory = Path.Combine(Path.GetTempPath(), $"trackerstats-whatsnew-{Guid.NewGuid():N}");
    private readonly string _databaseName = $"trackerstats-whatsnew-{Guid.NewGuid():N}";
    private readonly PluginStateStore _stateStore;

    public WhatsNewServiceTests()
    {
        _stateStore = new PluginStateStore(PluginStorageLayout.ForDataDirectory(_dataDirectory));
    }

    public void Dispose()
    {
        if (Directory.Exists(_dataDirectory))
            Directory.Delete(_dataDirectory, recursive: true);
    }

    [Fact]
    public async Task First_boot_should_open_once_with_the_release_notes_since_v0_4_0()
    {
        var report = await GetAsync("0.4.0");

        report.ShouldAutoOpen.ShouldBeTrue();
        report.LastReadAppVersion.ShouldBeNull();
        report.LastReadPluginChangeId.ShouldBeNull();
        report.App.Status.ShouldBe(AppReleaseStatus.Available);
        report.App.Releases.Select(release => release.Version).ShouldBe(["0.4.0"]);
        report.PluginUpdates.ShouldBeEmpty();

        await MarkReadAsync("0.4.0");

        var afterRead = await GetAsync("0.4.0");
        afterRead.ShouldAutoOpen.ShouldBeFalse();
        afterRead.LastReadAppVersion.ShouldBe("0.4.0");
        afterRead.LastReadPluginChangeId.ShouldBe(0);
        afterRead.LastReadAt.ShouldNotBeNull();
        afterRead.App.Releases.ShouldBeEmpty();
        afterRead.PluginUpdates.ShouldBeEmpty();
    }

    [Fact]
    public async Task Restart_with_nothing_new_should_not_open()
    {
        await MarkReadAsync("0.4.0");
        RecordPluginUpdate("asc");
        await MarkReadAsync("0.4.0");

        var report = await GetAsync("0.4.0");

        report.ShouldAutoOpen.ShouldBeFalse();
        report.App.Releases.ShouldBeEmpty();
        report.PluginUpdates.ShouldBeEmpty();
    }

    [Fact]
    public async Task App_update_only_should_open_with_the_releases_since_the_last_view()
    {
        await MarkReadAsync("0.4.0");

        var report = await GetAsync("0.4.1+abc123");

        report.ShouldAutoOpen.ShouldBeTrue();
        report.LastReadAppVersion.ShouldBe("0.4.0");
        report.App.InstalledVersion.ShouldBe("0.4.1");
        report.App.UpdateAvailable.ShouldBeTrue();
        report.App.Releases.Select(release => release.Version).ShouldBe(["0.4.1"]);
        report.App.Releases[0].Notes.ShouldBe("0.4.1 notes");
        report.PluginUpdates.ShouldBeEmpty();

        await MarkReadAsync("0.4.1+abc123");

        var afterRead = await GetAsync("0.4.1+abc123");
        afterRead.ShouldAutoOpen.ShouldBeFalse();
        afterRead.LastReadAppVersion.ShouldBe("0.4.1");
        afterRead.App.Releases.ShouldBeEmpty();
    }

    [Fact]
    public async Task Plugin_update_only_should_open_with_the_unread_plugin_updates()
    {
        await MarkReadAsync("0.4.0");
        var update = RecordPluginUpdate("asc");

        var report = await GetAsync("0.4.0");

        report.ShouldAutoOpen.ShouldBeTrue();
        report.App.Releases.ShouldBeEmpty();
        var unread = report.PluginUpdates.ShouldHaveSingleItem();
        unread.Id.ShouldBe(update.Id);
        unread.PluginId.ShouldBe("asc");
        unread.FromVersion.ShouldBe("1.0.0");
        unread.ToVersion.ShouldBe("1.1.0");
        unread.Changelog.Select(entry => entry.Notes).ShouldBe(["asc 1.1.0 notes"]);

        await MarkReadAsync("0.4.0");

        var afterRead = await GetAsync("0.4.0");
        afterRead.ShouldAutoOpen.ShouldBeFalse();
        afterRead.LastReadPluginChangeId.ShouldBe(update.Id);
        afterRead.PluginUpdates.ShouldBeEmpty();
    }

    [Fact]
    public async Task Mark_read_should_keep_plugin_updates_recorded_after_the_reader_saw_the_report()
    {
        await MarkReadAsync("0.4.0");
        var seen = RecordPluginUpdate("asc");
        var later = RecordPluginUpdate("seedpool");

        await using (var db = CreateDbContext())
            await CreateService(db, "0.4.0").MarkReadAsync(seen.Id);

        var report = await GetAsync("0.4.0");
        report.ShouldAutoOpen.ShouldBeTrue();
        report.PluginUpdates.ShouldHaveSingleItem().Id.ShouldBe(later.Id);
    }

    [Fact]
    public async Task App_and_plugin_updates_should_open_with_both_sections()
    {
        await MarkReadAsync("0.4.0");
        RecordPluginUpdate("asc");
        await MarkReadAsync("0.4.0");
        var seedpool = RecordPluginUpdate("seedpool");
        var fearnopeer = RecordPluginUpdate("fearnopeer");

        var report = await GetAsync("0.5.0");

        report.ShouldAutoOpen.ShouldBeTrue();
        report.App.UpdateAvailable.ShouldBeFalse();
        report.App.Releases.Select(release => release.Version).ShouldBe(["0.5.0", "0.4.1"]);
        report.PluginUpdates.Select(update => update.Id).ShouldBe([fearnopeer.Id, seedpool.Id]);

        await MarkReadAsync("0.5.0");

        var afterRead = await GetAsync("0.5.0");
        afterRead.ShouldAutoOpen.ShouldBeFalse();
        afterRead.App.Releases.ShouldBeEmpty();
        afterRead.PluginUpdates.ShouldBeEmpty();
    }

    [Fact]
    public async Task Unavailable_release_notes_should_still_open_after_an_app_update_and_list_plugin_updates()
    {
        await MarkReadAsync("0.4.0");
        RecordPluginUpdate("asc");

        var report = await GetAsync("0.4.1", HttpStatusCode.TooManyRequests);

        report.ShouldAutoOpen.ShouldBeTrue();
        report.App.Status.ShouldBe(AppReleaseStatus.Unavailable);
        report.App.Error.ShouldNotBeNull();
        report.PluginUpdates.ShouldHaveSingleItem().PluginId.ShouldBe("asc");

        await MarkReadAsync("0.4.1", HttpStatusCode.TooManyRequests);

        (await GetAsync("0.4.1")).ShouldAutoOpen.ShouldBeFalse();
    }

    [Fact]
    public async Task A_local_build_without_a_semantic_version_should_not_open_for_the_app()
    {
        var report = await GetAsync("Unknown");

        report.ShouldAutoOpen.ShouldBeFalse();

        await MarkReadAsync("Unknown");

        (await GetAsync("Unknown")).LastReadAppVersion.ShouldBeNull();
    }

    [Fact]
    public async Task Downgrading_should_keep_the_newer_last_read_version()
    {
        await MarkReadAsync("0.5.0");
        await MarkReadAsync("0.4.1");

        var report = await GetAsync("0.5.0");

        report.ShouldAutoOpen.ShouldBeFalse();
        report.LastReadAppVersion.ShouldBe("0.5.0");
    }

    [Fact]
    public async Task A_reset_state_file_should_show_its_new_plugin_updates()
    {
        _stateStore.Update(state => state.LastUpdateId = 5);
        await MarkReadAsync("0.4.0");
        File.Delete(PluginStorageLayout.ForDataDirectory(_dataDirectory).StateFilePath);
        var update = RecordPluginUpdate("asc");

        var report = await GetAsync("0.4.0");

        update.Id.ShouldBe(1);
        report.ShouldAutoOpen.ShouldBeTrue();
        report.PluginUpdates.ShouldHaveSingleItem().Id.ShouldBe(1);
    }

    [Fact]
    public async Task Endpoints_should_return_the_report_and_mark_it_read()
    {
        await MarkReadAsync("0.4.0");
        var update = RecordPluginUpdate("asc");

        await using (var db = CreateDbContext())
        {
            var controller = new WhatsNewController(CreateService(db, "0.4.1"));
            var json = TestHttp.ToJson((await controller.Get(CancellationToken.None)).ShouldBeOfType<OkObjectResult>().Value);

            json.GetProperty("shouldAutoOpen").GetBoolean().ShouldBeTrue();
            json.GetProperty("lastReadAppVersion").GetString().ShouldBe("0.4.0");
            json.GetProperty("lastReadPluginChangeId").GetInt64().ShouldBe(0);
            var app = json.GetProperty("app");
            app.GetProperty("status").GetString().ShouldBe("available");
            app.GetProperty("installedVersion").GetString().ShouldBe("0.4.1");
            app.GetProperty("updateAvailable").GetBoolean().ShouldBeTrue();
            app.GetProperty("latestRelease").GetProperty("version").GetString().ShouldBe("0.5.0");
            app.GetProperty("releases").EnumerateArray().ShouldHaveSingleItem().GetProperty("version").GetString().ShouldBe("0.4.1");
            var plugin = json.GetProperty("pluginUpdates").EnumerateArray().ShouldHaveSingleItem();
            plugin.GetProperty("id").GetInt64().ShouldBe(update.Id);
            plugin.GetProperty("pluginId").GetString().ShouldBe("asc");
            plugin.GetProperty("fromVersion").GetString().ShouldBe("1.0.0");
            plugin.GetProperty("toVersion").GetString().ShouldBe("1.1.0");
            plugin.GetProperty("changelog").EnumerateArray().ShouldHaveSingleItem().GetProperty("version").GetString().ShouldBe("1.1.0");

            (await controller.MarkRead(null, CancellationToken.None)).ShouldBeOfType<NoContentResult>();
        }

        await using (var db = CreateDbContext())
        {
            var controller = new WhatsNewController(CreateService(db, "0.4.1"));
            var json = TestHttp.ToJson((await controller.Get(CancellationToken.None)).ShouldBeOfType<OkObjectResult>().Value);

            json.GetProperty("shouldAutoOpen").GetBoolean().ShouldBeFalse();
            json.GetProperty("app").GetProperty("releases").GetArrayLength().ShouldBe(0);
            json.GetProperty("pluginUpdates").GetArrayLength().ShouldBe(0);
        }
    }

    private async Task<WhatsNewReport> GetAsync(string installedVersion, HttpStatusCode releasesStatus = HttpStatusCode.OK)
    {
        await using var db = CreateDbContext();
        return await CreateService(db, installedVersion, releasesStatus).GetAsync();
    }

    private async Task MarkReadAsync(string installedVersion, HttpStatusCode releasesStatus = HttpStatusCode.OK)
    {
        await using var db = CreateDbContext();
        await CreateService(db, installedVersion, releasesStatus).MarkReadAsync();
    }

    private PluginUpdateRecord RecordPluginUpdate(string pluginId)
    {
        PluginUpdateRecord? record = null;
        _stateStore.Update(state =>
        {
            state.LastUpdateId++;
            record = new PluginUpdateRecord(
                state.LastUpdateId,
                pluginId,
                "1.0.0",
                "1.1.0",
                DateTimeOffset.UtcNow,
                [new PluginIndexChangelogEntry("1.1.0", "2026-11-07", $"{pluginId} 1.1.0 notes")]);
            state.Updates.Add(record);
        });
        return record!;
    }

    // A new context per call stands in for a restart; the in-memory database outlives it.
    private AppDbContext CreateDbContext()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(_databaseName).Options);
        db.Database.EnsureCreated();
        return db;
    }

    private WhatsNewService CreateService(AppDbContext db, string installedVersion, HttpStatusCode releasesStatus = HttpStatusCode.OK)
    {
        var releases = new AppReleaseService(
            new ConfigurationBuilder().Build(),
            new StubHttpClientFactory(new StubHttpMessageHandler(_ => new HttpResponseMessage(releasesStatus)
            {
                Content = new StringContent(releasesStatus == HttpStatusCode.OK ? ReleasesJson : "{}", Encoding.UTF8, "application/json")
            })),
            new InstalledAppVersion(installedVersion),
            NullLogger<AppReleaseService>.Instance);
        return new WhatsNewService(db, releases, _stateStore);
    }
}
