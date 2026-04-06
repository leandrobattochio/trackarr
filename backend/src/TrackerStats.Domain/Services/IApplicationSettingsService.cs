namespace TrackerStats.Domain.Services;

public interface IApplicationSettingsService
{
    ApplicationSettingsSnapshot GetRequired();
    Task<ApplicationSettingsSnapshot> UpdateUserAgentAsync(string userAgent, CancellationToken ct);
}
