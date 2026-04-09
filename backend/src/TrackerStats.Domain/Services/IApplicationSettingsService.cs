namespace TrackerStats.Domain.Services;

public interface IApplicationSettingsService
{
    ApplicationSettingsSnapshot GetRequired();
    Task<ApplicationSettingsSnapshot> UpdateUserAgentAsync(string userAgent, CancellationToken ct);
    Task<ApplicationSettingsSnapshot> UpdateAsync(string userAgent, bool checkForUpdates, CancellationToken ct);
}
