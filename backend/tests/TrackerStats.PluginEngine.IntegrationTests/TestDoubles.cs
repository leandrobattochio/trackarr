using TrackerStats.Domain.Services;

namespace TrackerStats.PluginEngine.IntegrationTests;

internal sealed class FakeApplicationSettingsService(string userAgent = "test-user-agent") : IApplicationSettingsService
{
    private string _userAgent = userAgent;

    public ApplicationSettingsSnapshot GetRequired() => new(_userAgent, true);

    public Task<ApplicationSettingsSnapshot> UpdateUserAgentAsync(string userAgent, CancellationToken ct)
    {
        _userAgent = userAgent.Trim();
        return Task.FromResult(new ApplicationSettingsSnapshot(_userAgent, true));
    }

    public Task<ApplicationSettingsSnapshot> UpdateAsync(string userAgent, bool checkForUpdates, CancellationToken ct)
    {
        _userAgent = userAgent.Trim();
        return Task.FromResult(new ApplicationSettingsSnapshot(_userAgent, checkForUpdates, true));
    }
}
