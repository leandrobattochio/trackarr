using Microsoft.Extensions.Configuration;
using TrackerStats.Domain.Entities;

namespace TrackerStats.Infrastructure.Proxies;

public sealed record ProxyTestResult(bool Success, string TestUrl, int? StatusCode, string? Error);

public sealed class ProxyConnectionTester(IConfiguration configuration)
{
    public const string TestUrlKey = "Proxies:TestUrl";
    public const string DefaultTestUrl = "https://github.com/";

    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(15);

    public async Task<ProxyTestResult> TestAsync(TrackerProxy proxy, CancellationToken ct)
    {
        var testUrl = configuration[TestUrlKey] is { Length: > 0 } configured ? configured : DefaultTestUrl;
        using var client = new HttpClient(ProxyHandlerCache.CreateHandler(proxy)) { Timeout = Timeout };
        try
        {
            using var response = await client.GetAsync(testUrl, HttpCompletionOption.ResponseHeadersRead, ct);
            return new ProxyTestResult(true, testUrl, (int)response.StatusCode, null);
        }
        catch (TaskCanceledException) when (!ct.IsCancellationRequested)
        {
            return new ProxyTestResult(false, testUrl, null, $"No answer within {Timeout.TotalSeconds:0} seconds.");
        }
        catch (HttpRequestException exception)
        {
            return new ProxyTestResult(false, testUrl, null, Describe(exception));
        }
    }

    private static string Describe(Exception exception)
    {
        var messages = new List<string>();
        for (var current = exception; current is not null; current = current.InnerException)
        {
            if (!messages.Contains(current.Message))
                messages.Add(current.Message);
        }
        return string.Join(" ", messages);
    }
}
