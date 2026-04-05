namespace TrackerStats.Domain.Plugins.Yaml;

public interface IAuthFailureDetector
{
    TrackerFetchResult? Detect(HttpResponseMessage response, string responseBody, AuthFailureConfig? authFailure);
}
