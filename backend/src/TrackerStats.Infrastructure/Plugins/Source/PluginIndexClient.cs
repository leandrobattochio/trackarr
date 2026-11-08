using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using TrackerStats.Infrastructure.Plugins.Storage;

namespace TrackerStats.Infrastructure.Plugins.Source;

public sealed class PluginIndexClient(
    IConfiguration configuration,
    IHttpClientFactory httpClientFactory,
    ILogger<PluginIndexClient> logger)
{
    public const string HttpClientName = "PluginSource";
    public const string SourceUrlKey = "PluginSource:Url";
    public const string DefaultSourceUrl = "https://raw.githubusercontent.com/leandrobattochio/trackarr-plugins/main/";
    public const string IndexFileName = "index.json";
    public const int MaxFileBytes = 4 * 1024 * 1024;

    public string SourceUrl
    {
        get
        {
            var configured = configuration[SourceUrlKey];
            return string.IsNullOrWhiteSpace(configured) ? DefaultSourceUrl : configured.Trim();
        }
    }

    /// <param name="installed">Installed official plugins from <c>state.json</c>; entries with the same sha256 are not downloaded.</param>
    /// <param name="installedBases">Installed plugin bases from <c>state.json</c>, compared the same way.</param>
    public async Task<PluginIndexFetchResult> FetchAsync(
        IReadOnlyDictionary<string, OfficialPluginState> installed,
        IReadOnlyDictionary<string, OfficialPluginState>? installedBases = null,
        CancellationToken cancellationToken = default)
    {
        var source = SourceUrl;
        if (!TryResolveSource(source, out var baseUri, out var sourceError))
        {
            logger.LogWarning("Plugin source {Source} is invalid: {Error}", source, sourceError);
            return PluginIndexFetchResult.Failure(source, sourceError);
        }

        var indexUri = new Uri(baseUri, IndexFileName);
        byte[] indexBytes;
        try
        {
            indexBytes = await ReadAsync(indexUri, cancellationToken);
        }
        catch (Exception ex) when (IsSourceFailure(ex, cancellationToken))
        {
            var error = $"Could not fetch {indexUri}: {ex.Message}";
            logger.LogWarning("Plugin index download failed: {Error}", error);
            return PluginIndexFetchResult.Failure(source, error);
        }

        var indexSha256 = PluginStateStore.ComputeSha256(indexBytes);
        PluginIndex index;
        try
        {
            index = PluginIndexParser.Parse(indexBytes);
        }
        catch (FormatException ex)
        {
            logger.LogWarning("Plugin index {Uri} is malformed: {Error}", indexUri, ex.Message);
            return PluginIndexFetchResult.Failure(source, ex.Message, indexSha256);
        }

        var baseFiles = new List<PluginFileFetchResult>(index.Bases.Count);
        foreach (var entry in index.Bases)
            baseFiles.Add(await FetchFileAsync(baseUri, entry, installedBases ?? new Dictionary<string, OfficialPluginState>(), cancellationToken));

        var files = new List<PluginFileFetchResult>(index.Plugins.Count);
        foreach (var entry in index.Plugins)
            files.Add(await FetchFileAsync(baseUri, entry, installed, cancellationToken));

        logger.LogInformation(
            "Plugin index {Uri} ({Sha256}): {Downloaded} downloaded, {Unchanged} unchanged, {Failed} failed",
            indexUri,
            indexSha256,
            files.Concat(baseFiles).Count(file => file.Status == PluginFileFetchStatus.Downloaded),
            files.Concat(baseFiles).Count(file => file.Status == PluginFileFetchStatus.Unchanged),
            files.Concat(baseFiles).Count(file => file.Status == PluginFileFetchStatus.Failed));

        return new PluginIndexFetchResult(source, indexSha256, index, files, null) { BaseFiles = baseFiles };
    }

    private async Task<PluginFileFetchResult> FetchFileAsync(
        Uri baseUri,
        PluginIndexEntry entry,
        IReadOnlyDictionary<string, OfficialPluginState> installed,
        CancellationToken cancellationToken)
    {
        if (installed.TryGetValue(entry.Id, out var current) && current.Sha256 == entry.Sha256)
            return new PluginFileFetchResult(entry, PluginFileFetchStatus.Unchanged);

        var fileUri = new Uri(baseUri, entry.Path);
        byte[] content;
        try
        {
            content = await ReadAsync(fileUri, cancellationToken);
        }
        catch (Exception ex) when (IsSourceFailure(ex, cancellationToken))
        {
            return Failed(entry, $"Could not download {entry.Path}: {ex.Message}");
        }

        var actualSha256 = PluginStateStore.ComputeSha256(content);
        return actualSha256 == entry.Sha256
            ? new PluginFileFetchResult(entry, PluginFileFetchStatus.Downloaded, content)
            : Failed(entry, $"Rejected {entry.Path}: sha256 {actualSha256} does not match the index ({entry.Sha256}).");
    }

    private PluginFileFetchResult Failed(PluginIndexEntry entry, string error)
    {
        logger.LogWarning("Plugin {PluginId} {Version}: {Error}", entry.Id, entry.Version, error);
        return new PluginFileFetchResult(entry, PluginFileFetchStatus.Failed, Error: error);
    }

    private async Task<byte[]> ReadAsync(Uri uri, CancellationToken cancellationToken)
    {
        if (uri.IsFile)
        {
            var file = new FileInfo(uri.LocalPath);
            if (!file.Exists)
                throw new PluginSourceException("file not found.");
            if (file.Length > MaxFileBytes)
                throw new PluginSourceException($"file is larger than {MaxFileBytes} bytes.");
            return await File.ReadAllBytesAsync(file.FullName, cancellationToken);
        }

        using var client = httpClientFactory.CreateClient(HttpClientName);
        using var response = await client.GetAsync(uri, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        if (!response.IsSuccessStatusCode)
            throw new PluginSourceException($"HTTP {(int)response.StatusCode} {response.ReasonPhrase}".TrimEnd() + ".");
        if (response.Content.Headers.ContentLength > MaxFileBytes)
            throw new PluginSourceException($"response is larger than {MaxFileBytes} bytes.");

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var buffer = new MemoryStream();
        var chunk = new byte[81920];
        int read;
        while ((read = await stream.ReadAsync(chunk, cancellationToken)) > 0)
        {
            if (buffer.Length + read > MaxFileBytes)
                throw new PluginSourceException($"response is larger than {MaxFileBytes} bytes.");
            buffer.Write(chunk, 0, read);
        }

        return buffer.ToArray();
    }

    private static bool TryResolveSource(string source, out Uri baseUri, out string error)
    {
        baseUri = null!;
        error = string.Empty;
        if (!Uri.TryCreate(source, UriKind.Absolute, out var uri)
            || !(uri.IsFile || uri.Scheme == Uri.UriSchemeHttps))
        {
            error = $"PluginSource__Url '{source}' must be an https:// URL or a file:// folder.";
            return false;
        }

        baseUri = uri.AbsoluteUri.EndsWith('/') ? uri : new Uri(uri.AbsoluteUri + "/");
        return true;
    }

    // Timeouts surface as TaskCanceledException; a cancellation requested by the caller still propagates.
    private static bool IsSourceFailure(Exception exception, CancellationToken cancellationToken) =>
        exception is HttpRequestException or IOException or UnauthorizedAccessException or PluginSourceException
        || (exception is OperationCanceledException && !cancellationToken.IsCancellationRequested);

    private sealed class PluginSourceException(string message) : Exception(message);
}
