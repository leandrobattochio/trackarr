using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using System.Text;

namespace TrackerStats.Api.EndToEndTests;

// tracker.test only resolves inside these proxies, so a request that reaches the tracker went through one.
internal static class FakeTracker
{
    public const string Host = "tracker.test";
    public const string BaseUrl = "http://tracker.test/";
    public const string ApiKey = "proxy-e2e-key";

    public const string PluginYaml = """
        pluginId: proxied-tracker
        displayName: Proxied Tracker
        version: 1.0.0
        schemaVersion: 1

        baseUrls:
          - http://tracker.test/

        fields:
          - name: apiKey
            label: API Key
            type: password
            required: true
            sensitive: true

        steps:
          - name: user
            method: GET
            url: "api/user?api_token={{apiKey}}"
            responseType: json
            extract:
              username:
                path: "username"
                transform: toString
              uploaded:
                path: "uploaded"
                transform: integer
              downloaded:
                path: "downloaded"
                transform: integer
              ratio:
                path: "ratio"
                transform: decimal
              seeding:
                path: "seeding"
                transform: integer
              leeching:
                path: "leeching"
                transform: integer
            validate:
              - field: username
                rule: notEmpty
                onFail: unknownError

        mapping:
          ratio: "steps.user.ratio"
          uploadedBytes: "steps.user.uploaded"
          downloadedBytes: "steps.user.downloaded"
          seedBonus: "steps.user.username"
          buffer: "steps.user.username"
          hitAndRuns: "steps.user.leeching"
          requiredRatio: "fields.required_ratio"
          seedingTorrents: "steps.user.seeding"
          leechingTorrents: "steps.user.leeching"
          activeTorrents: "steps.user.seeding + steps.user.leeching"

        dashboard:
          metrics:
            - stat: uploadedBytes
              label: Uploaded
              format: bytes
              icon: arrow-up
              tone: success
        """;

    public static byte[] Respond(string pathAndQuery)
    {
        var (status, body) = pathAndQuery == $"/api/user?api_token={ApiKey}"
            ? ("200 OK", """{"username":"proxied","uploaded":3000,"downloaded":1000,"ratio":3.0,"seeding":5,"leeching":0}""")
            : ("404 Not Found", """{"error":"unknown path"}""");
        return Encoding.ASCII.GetBytes(
            $"HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {Encoding.UTF8.GetByteCount(body)}\r\n" +
            $"Connection: close\r\n\r\n{body}");
    }

    public static async Task<List<string>> ReadHeadAsync(Stream stream, CancellationToken ct)
    {
        var bytes = new List<byte>();
        var buffer = new byte[1];
        while (!EndsWithBlankLine(bytes) && await stream.ReadAsync(buffer, ct) == 1)
            bytes.Add(buffer[0]);
        return Encoding.ASCII.GetString(bytes.ToArray())
            .Split("\r\n", StringSplitOptions.RemoveEmptyEntries)
            .ToList();
    }

    private static bool EndsWithBlankLine(List<byte> bytes) =>
        bytes.Count >= 4 && bytes[^4] == '\r' && bytes[^3] == '\n' && bytes[^2] == '\r' && bytes[^1] == '\n';
}

internal abstract class TestProxy : IAsyncDisposable
{
    private readonly TcpListener _listener = new(IPAddress.Loopback, 0);
    private readonly CancellationTokenSource _stop = new();
    private readonly Task _accepting;

    protected TestProxy(string username, string password)
    {
        Username = username;
        Password = password;
        _listener.Start();
        _accepting = AcceptAsync();
    }

    public string Username { get; }
    public string Password { get; }
    public int Port => ((IPEndPoint)_listener.LocalEndpoint).Port;
    public ConcurrentQueue<string> Requests { get; } = new();

    protected abstract Task HandleAsync(NetworkStream stream, CancellationToken ct);

    private async Task AcceptAsync()
    {
        while (!_stop.IsCancellationRequested)
        {
            TcpClient client;
            try
            {
                client = await _listener.AcceptTcpClientAsync(_stop.Token);
            }
            catch (OperationCanceledException)
            {
                return;
            }

            _ = Task.Run(async () =>
            {
                using (client)
                {
                    try
                    {
                        await HandleAsync(client.GetStream(), _stop.Token);
                    }
                    catch (Exception exception) when (exception is IOException or OperationCanceledException)
                    {
                    }
                }
            });
        }
    }

    public async ValueTask DisposeAsync()
    {
        await _stop.CancelAsync();
        _listener.Stop();
        await _accepting;
        _stop.Dispose();
    }
}

// Answers the absolute-URI requests an HTTP proxy receives, asking for Basic credentials first.
internal sealed class TestHttpProxy(string username, string password) : TestProxy(username, password)
{
    protected override async Task HandleAsync(NetworkStream stream, CancellationToken ct)
    {
        while (true)
        {
            var head = await FakeTracker.ReadHeadAsync(stream, ct);
            if (head.Count == 0)
                return;

            var target = new Uri(head[0].Split(' ')[1]);
            var expected = "Basic " + Convert.ToBase64String(Encoding.ASCII.GetBytes($"{Username}:{Password}"));
            var authorized = head.Any(line => line.Equals($"Proxy-Authorization: {expected}", StringComparison.OrdinalIgnoreCase));
            if (!authorized)
            {
                await stream.WriteAsync(Encoding.ASCII.GetBytes(
                    "HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm=\"test\"\r\n" +
                    "Content-Length: 0\r\n\r\n"), ct);
                continue;
            }

            Requests.Enqueue(target.AbsoluteUri);
            await stream.WriteAsync(target.Host == FakeTracker.Host
                ? FakeTracker.Respond(target.PathAndQuery)
                : Encoding.ASCII.GetBytes("HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"), ct);
            return;
        }
    }
}

// A SOCKS5 server with username/password auth (RFC 1928 and RFC 1929) whose only upstream is the fake tracker.
internal sealed class TestSocks5Proxy(string username, string password) : TestProxy(username, password)
{
    protected override async Task HandleAsync(NetworkStream stream, CancellationToken ct)
    {
        var greeting = await ReadExactlyAsync(stream, 2, ct);
        var methods = await ReadExactlyAsync(stream, greeting[1], ct);
        if (!methods.Contains((byte)0x02))
        {
            await stream.WriteAsync(new byte[] { 0x05, 0xFF }, ct);
            return;
        }
        await stream.WriteAsync(new byte[] { 0x05, 0x02 }, ct);

        await ReadExactlyAsync(stream, 1, ct);
        var user = Encoding.ASCII.GetString(await ReadExactlyAsync(stream, (await ReadExactlyAsync(stream, 1, ct))[0], ct));
        var pass = Encoding.ASCII.GetString(await ReadExactlyAsync(stream, (await ReadExactlyAsync(stream, 1, ct))[0], ct));
        var authorized = user == Username && pass == Password;
        await stream.WriteAsync(new byte[] { 0x01, authorized ? (byte)0x00 : (byte)0x01 }, ct);
        if (!authorized)
            return;

        var request = await ReadExactlyAsync(stream, 4, ct);
        var host = request[3] switch
        {
            0x03 => Encoding.ASCII.GetString(await ReadExactlyAsync(stream, (await ReadExactlyAsync(stream, 1, ct))[0], ct)),
            0x01 => new IPAddress(await ReadExactlyAsync(stream, 4, ct)).ToString(),
            _ => new IPAddress(await ReadExactlyAsync(stream, 16, ct)).ToString()
        };
        var portBytes = await ReadExactlyAsync(stream, 2, ct);
        var port = (portBytes[0] << 8) | portBytes[1];

        var reachable = host == FakeTracker.Host && port == 80;
        await stream.WriteAsync(new byte[] { 0x05, reachable ? (byte)0x00 : (byte)0x04, 0x00, 0x01, 0, 0, 0, 0, 0, 0 }, ct);
        if (!reachable)
            return;

        var head = await FakeTracker.ReadHeadAsync(stream, ct);
        var pathAndQuery = head[0].Split(' ')[1];
        Requests.Enqueue($"{host}:{port}{pathAndQuery}");
        await stream.WriteAsync(FakeTracker.Respond(pathAndQuery), ct);
    }

    private static async Task<byte[]> ReadExactlyAsync(Stream stream, int count, CancellationToken ct)
    {
        var buffer = new byte[count];
        await stream.ReadExactlyAsync(buffer, ct);
        return buffer;
    }
}
