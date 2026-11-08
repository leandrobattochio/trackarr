using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;
using TrackerStats.Infrastructure.Plugins.Source;
using TrackerStats.Infrastructure.Plugins.Storage;

namespace TrackerStats.Backend.Tests;

public sealed class PluginIndexClientTests : IDisposable
{
    private const string SourceUrl = "https://plugins.example.test/repo/main/";
    private static readonly byte[] AscYaml = Encoding.UTF8.GetBytes("pluginId: asc\n# comment kept\n");
    private static readonly byte[] SeedpoolYaml = Encoding.UTF8.GetBytes("pluginId: seedpool\n");

    private readonly string _sourceDirectory = Path.Combine(Path.GetTempPath(), $"trackerstats-source-{Guid.NewGuid():N}");

    public void Dispose()
    {
        if (Directory.Exists(_sourceDirectory))
            Directory.Delete(_sourceDirectory, recursive: true);
    }

    [Fact]
    public async Task Fetch_over_https_should_download_changed_files_and_verify_them()
    {
        var files = new Dictionary<string, byte[]>
        {
            ["plugins/asc.yaml"] = AscYaml,
            ["plugins/seedpool.yaml"] = SeedpoolYaml
        };
        var handler = ServeHttp(Index(Entry("asc", AscYaml), Entry("seedpool", SeedpoolYaml)), files);
        var installed = Installed(("asc", PluginStateStore.ComputeSha256(AscYaml)), ("seedpool", new string('0', 64)));

        var result = await CreateClient(handler, SourceUrl).FetchAsync(installed);

        result.Succeeded.ShouldBeTrue();
        result.Source.ShouldBe(SourceUrl);
        result.IndexSha256.ShouldMatch("^[0-9a-f]{64}$");
        result.Index!.Plugins.Select(plugin => plugin.Id).ShouldBe(["asc", "seedpool"]);
        result.Index.Plugins[0].Changelog.ShouldHaveSingleItem().Notes.ShouldBe("First release.");
        result.Files.Single(file => file.Entry.Id == "asc").Status.ShouldBe(PluginFileFetchStatus.Unchanged);
        var seedpool = result.Files.Single(file => file.Entry.Id == "seedpool");
        seedpool.Status.ShouldBe(PluginFileFetchStatus.Downloaded);
        seedpool.Content.ShouldBe(SeedpoolYaml);
        handler.Requests.Select(uri => uri.AbsoluteUri).ShouldBe(
        [
            $"{SourceUrl}index.json",
            $"{SourceUrl}plugins/seedpool.yaml"
        ]);
    }

    [Fact]
    public async Task Fetch_should_use_default_github_source_when_not_configured()
    {
        var handler = ServeHttp(Index(Entry("asc", AscYaml)), new() { ["plugins/asc.yaml"] = AscYaml });

        var result = await CreateClient(handler, sourceUrl: null).FetchAsync(Installed());

        result.Source.ShouldBe("https://raw.githubusercontent.com/leandrobattochio/trackarr-plugins/main/");
        handler.Requests.Select(uri => uri.AbsoluteUri).ShouldBe(
        [
            "https://raw.githubusercontent.com/leandrobattochio/trackarr-plugins/main/index.json",
            "https://raw.githubusercontent.com/leandrobattochio/trackarr-plugins/main/plugins/asc.yaml"
        ]);
        result.Files.ShouldHaveSingleItem().Status.ShouldBe(PluginFileFetchStatus.Downloaded);
    }

    [Fact]
    public async Task Fetch_should_append_missing_trailing_slash_to_source()
    {
        var ascSha = PluginStateStore.ComputeSha256(AscYaml);
        var handler = ServeHttp(Index(Entry("asc", AscYaml)), []);

        var result = await CreateClient(handler, "https://mirror.example.test/plugins").FetchAsync(Installed(("asc", ascSha)));

        result.Succeeded.ShouldBeTrue();
        handler.Requests.ShouldHaveSingleItem().AbsoluteUri.ShouldBe("https://mirror.example.test/plugins/index.json");
    }

    [Fact]
    public async Task Fetch_should_reject_file_whose_sha256_does_not_match_index()
    {
        var tampered = Encoding.UTF8.GetBytes("pluginId: asc\nbaseUrls: [https://evil.example]\n");
        var handler = ServeHttp(
            Index(Entry("asc", AscYaml), Entry("seedpool", SeedpoolYaml)),
            new() { ["plugins/asc.yaml"] = tampered, ["plugins/seedpool.yaml"] = SeedpoolYaml });

        var result = await CreateClient(handler, SourceUrl).FetchAsync(Installed());

        result.Succeeded.ShouldBeTrue();
        var asc = result.Files.Single(file => file.Entry.Id == "asc");
        asc.Status.ShouldBe(PluginFileFetchStatus.Failed);
        asc.Content.ShouldBeNull();
        asc.Error.ShouldNotBeNull();
        asc.Error.ShouldContain("plugins/asc.yaml");
        asc.Error.ShouldContain("sha256");
        result.Files.Single(file => file.Entry.Id == "seedpool").Status.ShouldBe(PluginFileFetchStatus.Downloaded);
    }

    [Fact]
    public async Task Fetch_should_report_file_that_cannot_be_downloaded()
    {
        var handler = ServeHttp(Index(Entry("asc", AscYaml)), []);

        var result = await CreateClient(handler, SourceUrl).FetchAsync(Installed());

        result.Succeeded.ShouldBeTrue();
        var asc = result.Files.ShouldHaveSingleItem();
        asc.Status.ShouldBe(PluginFileFetchStatus.Failed);
        asc.Error.ShouldBe("Could not download plugins/asc.yaml: HTTP 404 Not Found.");
    }

    public static TheoryData<string> MalformedIndexes => new()
    {
        "not json",
        "[]",
        "{}",
        """{"plugins": [null]}""",
        """{"plugins": [{"id": "asc"}]}""",
        IndexJson(EntryJson("ASC")),
        IndexJson(EntryJson("asc", version: "1.0")),
        IndexJson(EntryJson("asc", schemaVersion: "0")),
        IndexJson(EntryJson("asc", schemaVersion: "\"1\"")),
        IndexJson(EntryJson("asc", path: "../outside.yaml")),
        IndexJson(EntryJson("asc", path: "/etc/asc.yaml")),
        IndexJson(EntryJson("asc", path: "plugins/../../asc.yaml")),
        IndexJson(EntryJson("asc", path: "https://evil.example/asc.yaml")),
        IndexJson(EntryJson("asc", path: "plugins/asc.yml")),
        IndexJson(EntryJson("asc", sha256: new string('A', 64))),
        IndexJson(EntryJson("asc", sha256: "abc")),
        IndexJson(EntryJson("asc", changelog: """[{"version": "1.0.0"}]""")),
        IndexJson(EntryJson("asc"), EntryJson("asc")),
        IndexJson()
    };

    [Theory]
    [MemberData(nameof(MalformedIndexes))]
    public async Task Fetch_should_fail_without_downloading_when_index_is_malformed(string indexJson)
    {
        var handler = ServeHttp(indexJson, new() { ["plugins/asc.yaml"] = AscYaml });

        var result = await CreateClient(handler, SourceUrl).FetchAsync(Installed());

        result.Succeeded.ShouldBeFalse();
        result.Error.ShouldNotBeNullOrWhiteSpace();
        result.Index.ShouldBeNull();
        result.Files.ShouldBeEmpty();
        result.IndexSha256.ShouldBe(PluginStateStore.ComputeSha256(Encoding.UTF8.GetBytes(indexJson)));
        handler.Requests.ShouldHaveSingleItem();
    }

    [Fact]
    public async Task Fetch_should_fail_when_source_is_unreachable()
    {
        var handler = new StubHttpMessageHandler(_ => throw new HttpRequestException("Name or service not known"));

        var result = await CreateClient(handler, SourceUrl).FetchAsync(Installed());

        result.Succeeded.ShouldBeFalse();
        result.Error.ShouldBe($"Could not fetch {SourceUrl}index.json: Name or service not known");
        result.Index.ShouldBeNull();
        result.Files.ShouldBeEmpty();
    }

    [Fact]
    public async Task Fetch_should_fail_when_request_times_out()
    {
        var handler = new StubHttpMessageHandler(_ => throw new TaskCanceledException("The request timed out."));

        var result = await CreateClient(handler, SourceUrl).FetchAsync(Installed());

        result.Succeeded.ShouldBeFalse();
        result.Error!.ShouldContain("timed out");
    }

    [Theory]
    [InlineData(HttpStatusCode.NotFound)]
    [InlineData(HttpStatusCode.Forbidden)]
    [InlineData(HttpStatusCode.InternalServerError)]
    public async Task Fetch_should_fail_when_index_request_is_not_successful(HttpStatusCode status)
    {
        var handler = new StubHttpMessageHandler(_ => new HttpResponseMessage(status));

        var result = await CreateClient(handler, SourceUrl).FetchAsync(Installed());

        result.Succeeded.ShouldBeFalse();
        result.Error!.ShouldContain($"HTTP {(int)status}");
        result.IndexSha256.ShouldBeNull();
    }

    [Fact]
    public async Task Fetch_should_propagate_caller_cancellation()
    {
        var handler = ServeHttp(Index(), []);
        using var cancellation = new CancellationTokenSource();
        await cancellation.CancelAsync();

        await Should.ThrowAsync<OperationCanceledException>(
            () => CreateClient(handler, SourceUrl).FetchAsync(Installed(), cancellationToken: cancellation.Token));
    }

    [Theory]
    [InlineData("http://plugins.example.test/")]
    [InlineData("ftp://plugins.example.test/")]
    [InlineData("not a url")]
    public async Task Fetch_should_reject_source_that_is_neither_https_nor_file(string source)
    {
        var handler = ServeHttp(Index(), []);

        var result = await CreateClient(handler, source).FetchAsync(Installed());

        result.Succeeded.ShouldBeFalse();
        result.Error!.ShouldContain("PluginSource__Url");
        handler.Requests.ShouldBeEmpty();
    }

    [Fact]
    public async Task Fetch_from_file_folder_should_download_changed_files()
    {
        WriteSource("plugins/asc.yaml", AscYaml);
        WriteSource("plugins/seedpool.yaml", SeedpoolYaml);
        WriteSource("index.json", Encoding.UTF8.GetBytes(Index(Entry("asc", AscYaml), Entry("seedpool", SeedpoolYaml))));
        var source = new Uri(_sourceDirectory).AbsoluteUri;
        var handler = ServeHttp(Index(), []);
        var installed = Installed(("seedpool", PluginStateStore.ComputeSha256(SeedpoolYaml)));

        var result = await CreateClient(handler, source).FetchAsync(installed);

        source.ShouldStartWith("file://");
        result.Succeeded.ShouldBeTrue();
        result.Source.ShouldBe(source);
        var asc = result.Files.Single(file => file.Entry.Id == "asc");
        asc.Status.ShouldBe(PluginFileFetchStatus.Downloaded);
        asc.Content.ShouldBe(AscYaml);
        result.Files.Single(file => file.Entry.Id == "seedpool").Status.ShouldBe(PluginFileFetchStatus.Unchanged);
        handler.Requests.ShouldBeEmpty();
    }

    [Fact]
    public async Task Fetch_from_file_folder_should_reject_sha256_mismatch()
    {
        WriteSource("plugins/asc.yaml", Encoding.UTF8.GetBytes("pluginId: asc\nedited: true\n"));
        WriteSource("index.json", Encoding.UTF8.GetBytes(Index(Entry("asc", AscYaml))));

        var result = await CreateClient(ServeHttp(Index(), []), new Uri(_sourceDirectory).AbsoluteUri).FetchAsync(Installed());

        var asc = result.Files.ShouldHaveSingleItem();
        asc.Status.ShouldBe(PluginFileFetchStatus.Failed);
        asc.Error!.ShouldContain("does not match the index");
    }

    [Fact]
    public async Task Fetch_from_file_folder_should_report_missing_plugin_file()
    {
        WriteSource("index.json", Encoding.UTF8.GetBytes(Index(Entry("asc", AscYaml))));

        var result = await CreateClient(ServeHttp(Index(), []), new Uri(_sourceDirectory).AbsoluteUri).FetchAsync(Installed());

        var asc = result.Files.ShouldHaveSingleItem();
        asc.Status.ShouldBe(PluginFileFetchStatus.Failed);
        asc.Error.ShouldBe("Could not download plugins/asc.yaml: file not found.");
    }

    [Fact]
    public async Task Fetch_from_file_folder_should_fail_when_index_is_malformed()
    {
        WriteSource("plugins/asc.yaml", AscYaml);
        WriteSource("index.json", Encoding.UTF8.GetBytes("{\"plugins\": ["));

        var result = await CreateClient(ServeHttp(Index(), []), new Uri(_sourceDirectory).AbsoluteUri).FetchAsync(Installed());

        result.Succeeded.ShouldBeFalse();
        result.Error!.ShouldStartWith("index.json is not valid JSON");
        result.Files.ShouldBeEmpty();
    }

    [Fact]
    public async Task Fetch_from_missing_file_folder_should_fail()
    {
        var source = new Uri(Path.Combine(_sourceDirectory, "missing")).AbsoluteUri;

        var result = await CreateClient(ServeHttp(Index(), []), source).FetchAsync(Installed());

        result.Succeeded.ShouldBeFalse();
        result.Error.ShouldBe($"Could not fetch {source}/index.json: file not found.");
        result.Index.ShouldBeNull();
    }

    private static PluginIndexClient CreateClient(HttpMessageHandler handler, string? sourceUrl) =>
        new(
            new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?> { [PluginIndexClient.SourceUrlKey] = sourceUrl })
                .Build(),
            new StubHttpClientFactory(handler),
            NullLogger<PluginIndexClient>.Instance);

    private static StubHttpMessageHandler ServeHttp(string indexJson, Dictionary<string, byte[]> files) =>
        new(request =>
        {
            var path = request.RequestUri!.AbsolutePath;
            if (path.EndsWith("/index.json", StringComparison.Ordinal))
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(indexJson) };

            var match = files.FirstOrDefault(file => path.EndsWith($"/{file.Key}", StringComparison.Ordinal));
            return match.Value is null
                ? new HttpResponseMessage(HttpStatusCode.NotFound)
                : new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent(match.Value) };
        });

    private void WriteSource(string relativePath, byte[] content)
    {
        var path = Path.Combine(_sourceDirectory, relativePath);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllBytes(path, content);
    }

    private static Dictionary<string, OfficialPluginState> Installed(params (string Id, string Sha256)[] plugins) =>
        plugins.ToDictionary(plugin => plugin.Id, plugin => new OfficialPluginState("1.0.0", plugin.Sha256));

    private static string Entry(string id, byte[] content) =>
        EntryJson(id, sha256: PluginStateStore.ComputeSha256(content));

    private static string Index(params string[] entries) => IndexJson(entries);

    private static string IndexJson(params string[] entries) => $$"""{"plugins": [{{string.Join(",", entries)}}]}""";

    private static string EntryJson(
        string id,
        string version = "1.0.0",
        string schemaVersion = "1",
        string? path = null,
        string? sha256 = null,
        string changelog = """[{"version": "1.0.0", "date": "2026-11-07", "notes": "First release."}]""") =>
        $$"""
          {
            "id": {{JsonSerializer.Serialize(id)}},
            "version": {{JsonSerializer.Serialize(version)}},
            "schemaVersion": {{schemaVersion}},
            "path": {{JsonSerializer.Serialize(path ?? $"plugins/{id}.yaml")}},
            "sha256": {{JsonSerializer.Serialize(sha256 ?? new string('a', 64))}},
            "changelog": {{changelog}}
          }
          """;
}
