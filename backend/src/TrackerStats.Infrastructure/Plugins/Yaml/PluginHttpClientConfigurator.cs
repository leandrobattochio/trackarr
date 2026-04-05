using TrackerStats.Domain.Plugins;
using TrackerStats.Domain.Plugins.Yaml;

namespace TrackerStats.Infrastructure.Plugins.Yaml;

public static class PluginHttpClientConfigurator
{
    public static void Configure(
        HttpClient httpClient,
        PluginDefinition definition,
        PluginConfiguration configuration,
        ITemplateInterpolator interpolator)
    {
        var http = definition.Http;
        if (http is null)
            return;

        if (!string.IsNullOrWhiteSpace(http.BaseUrl))
        {
            var baseUrl = interpolator.InterpolateFieldValues(http.BaseUrl, configuration);
            if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var uri))
                throw new InvalidOperationException($"The plugin baseUrl '{baseUrl}' is not a valid absolute URL.");
            httpClient.BaseAddress = uri;
        }

        foreach (var (headerName, headerValue) in http.Headers)
        {
            var interpolated = interpolator.InterpolateFieldValues(headerValue, configuration);

            if (headerName.Equals("Cookie", StringComparison.OrdinalIgnoreCase))
            {
                httpClient.DefaultRequestHeaders.TryAddWithoutValidation(headerName, interpolated);
            }
            else if (headerName.Equals("User-Agent", StringComparison.OrdinalIgnoreCase))
            {
                httpClient.DefaultRequestHeaders.UserAgent.ParseAdd(interpolated);
            }
            else if (headerName.Equals("Accept", StringComparison.OrdinalIgnoreCase))
            {
                httpClient.DefaultRequestHeaders.Accept.ParseAdd(interpolated);
            }
            else
            {
                httpClient.DefaultRequestHeaders.TryAddWithoutValidation(headerName, interpolated);
            }
        }

        if (http.Cookies.Count > 0)
        {
            var cookieParts = http.Cookies
                .Select(c => $"{c.Key}={interpolator.InterpolateFieldValues(c.Value, configuration)}");
            httpClient.DefaultRequestHeaders.TryAddWithoutValidation("Cookie",
                string.Join("; ", cookieParts));
        }
    }
}
