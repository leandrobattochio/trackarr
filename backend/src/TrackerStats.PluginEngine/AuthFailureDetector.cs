using System.Net;
using TrackerStats.Domain.Plugins;
using TrackerStats.Domain.Plugins.Yaml;

namespace TrackerStats.PluginEngine;

public class AuthFailureDetector : IAuthFailureDetector
{
    public TrackerFetchResult? Detect(
        HttpResponseMessage response,
        string responseBody,
        AuthFailureConfig? authFailure)
    {
        if (authFailure is null)
        {
            if (response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
                return new TrackerFetchResult(PluginProcessResult.AuthFailed);
            return null;
        }

        if (authFailure.HttpStatusCodes.Contains((int)response.StatusCode))
            return new TrackerFetchResult(PluginProcessResult.AuthFailed);

        foreach (var pattern in authFailure.HtmlPatterns)
        {
            if (responseBody.Contains(pattern, StringComparison.OrdinalIgnoreCase))
                return new TrackerFetchResult(PluginProcessResult.AuthFailed);
        }

        return null;
    }
}
