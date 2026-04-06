using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TrackerStats.Domain.Entities;
using TrackerStats.Domain.Services;
using TrackerStats.Infrastructure.Data;

namespace TrackerStats.Infrastructure.Services;

public sealed class ApplicationSettingsService(IServiceScopeFactory scopeFactory) : IApplicationSettingsService
{
    public ApplicationSettingsSnapshot GetRequired()
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var settings = db.ApplicationSettings.SingleOrDefault(static s => s.Id == 1)
            ?? throw new InvalidOperationException("Application settings row was not found.");

        return new ApplicationSettingsSnapshot(settings.UserAgent);
    }

    public async Task<ApplicationSettingsSnapshot> UpdateUserAgentAsync(string userAgent, CancellationToken ct)
    {
        var normalizedUserAgent = userAgent.Trim();
        if (string.IsNullOrWhiteSpace(normalizedUserAgent))
            throw new ArgumentException("User-Agent must not be empty.", nameof(userAgent));

        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var settings = await db.ApplicationSettings.SingleOrDefaultAsync(static s => s.Id == 1, ct)
            ?? throw new InvalidOperationException("Application settings row was not found.");

        settings.UserAgent = normalizedUserAgent;
        await db.SaveChangesAsync(ct);

        return new ApplicationSettingsSnapshot(settings.UserAgent);
    }
}
