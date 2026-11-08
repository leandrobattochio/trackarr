using Microsoft.AspNetCore.Mvc;
using Shouldly;
using TrackerStats.Api.Controllers;
using TrackerStats.Infrastructure.Plugins.Storage;

namespace TrackerStats.Backend.Tests;

public sealed class AboutControllerTests : IDisposable
{
    private readonly string _rootDirectory = Path.Combine(Path.GetTempPath(), $"trackerstats-about-{Guid.NewGuid():N}");

    [Fact]
    public void Get_should_return_database_engine()
    {
        var controller = CreateController();

        var result = controller.Get();

        var ok = result.ShouldBeOfType<OkObjectResult>();
        var json = TestHttp.ToJson(ok.Value);
        json.GetProperty("databaseEngine").GetString().ShouldBe("PostgreSQL");
        json.GetProperty("version").GetString().ShouldBe("1.0.0-test");
        json.GetProperty("dotNetVersion").GetString().ShouldBe("10.0.0");
        json.GetProperty("runningInDocker").GetBoolean().ShouldBeFalse();
        json.GetProperty("appliedMigrations").GetInt32().ShouldBe(3);
        json.GetProperty("appDataDirectory").GetString().ShouldBe("/data");
        json.GetProperty("startupDirectory").GetString().ShouldBe("/app");
        json.GetProperty("environmentName").GetString().ShouldBe("Development");
        json.GetProperty("uptime").GetString().ShouldBe("01:23:45");
    }

    [Fact]
    public void GetPluginDownload_should_return_nulls_before_any_download()
    {
        var json = GetPluginDownloadJson(CreateController());

        json.GetProperty("lastDownload").ValueKind.ShouldBe(System.Text.Json.JsonValueKind.Null);
        json.GetProperty("lastSuccessfulIndex").ValueKind.ShouldBe(System.Text.Json.JsonValueKind.Null);
    }

    [Fact]
    public void GetPluginDownload_should_return_the_last_report_with_per_plugin_outcomes()
    {
        var completedAt = new DateTimeOffset(2026, 11, 7, 12, 0, 5, TimeSpan.Zero);
        var store = new PluginStateStore(PluginStorageLayout.ForDataDirectory(_rootDirectory));
        store.Update(state =>
        {
            state.Index = new PluginIndexState("https://plugins.example/", "abc123", completedAt, new(StringComparer.Ordinal));
            state.LastDownload = new PluginDownloadReport(
                completedAt.AddSeconds(-5),
                completedAt,
                "https://plugins.example/",
                "abc123",
                null,
                [
                    new PluginDownloadPluginResult("asc", "1.1.0", PluginDownloadOutcome.Updated),
                    new PluginDownloadPluginResult("seedpool", "1.0.0", PluginDownloadOutcome.LocallyModified, Overridden: true, Message: "kept")
                ]);
        });

        var json = GetPluginDownloadJson(CreateController());

        var report = json.GetProperty("lastDownload");
        report.GetProperty("source").GetString().ShouldBe("https://plugins.example/");
        report.GetProperty("indexSha256").GetString().ShouldBe("abc123");
        report.GetProperty("succeeded").GetBoolean().ShouldBeTrue();
        report.GetProperty("completedAt").GetDateTimeOffset().ShouldBe(completedAt);
        var plugins = report.GetProperty("plugins");
        plugins.GetArrayLength().ShouldBe(2);
        plugins[0].GetProperty("outcome").GetString().ShouldBe("updated");
        plugins[1].GetProperty("outcome").GetString().ShouldBe("locallyModified");
        plugins[1].GetProperty("overridden").GetBoolean().ShouldBeTrue();
        plugins[1].GetProperty("message").GetString().ShouldBe("kept");
        json.GetProperty("lastSuccessfulIndex").GetProperty("sha256").GetString().ShouldBe("abc123");
    }

    [Fact]
    public void GetPluginDownload_should_return_the_error_of_a_failed_download()
    {
        var store = new PluginStateStore(PluginStorageLayout.ForDataDirectory(_rootDirectory));
        store.Update(state => state.LastDownload = new PluginDownloadReport(
            DateTimeOffset.UtcNow, DateTimeOffset.UtcNow, "https://plugins.example/", null, "Could not download index.json", []));

        var json = GetPluginDownloadJson(CreateController());

        var report = json.GetProperty("lastDownload");
        report.GetProperty("succeeded").GetBoolean().ShouldBeFalse();
        report.GetProperty("error").GetString().ShouldBe("Could not download index.json");
        report.GetProperty("indexSha256").ValueKind.ShouldBe(System.Text.Json.JsonValueKind.Null);
        report.GetProperty("plugins").GetArrayLength().ShouldBe(0);
    }

    private AboutController CreateController() =>
        new(new FakeAboutService("PostgreSQL"), new PluginStateStore(PluginStorageLayout.ForDataDirectory(_rootDirectory)));

    private static System.Text.Json.JsonElement GetPluginDownloadJson(AboutController controller) =>
        TestHttp.ToJson(controller.GetPluginDownload().ShouldBeOfType<OkObjectResult>().Value);

    public void Dispose()
    {
        if (Directory.Exists(_rootDirectory))
            Directory.Delete(_rootDirectory, recursive: true);
    }
}
