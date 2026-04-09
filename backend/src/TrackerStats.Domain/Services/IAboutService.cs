namespace TrackerStats.Domain.Services;

public interface IAboutService
{
    Task<AboutSnapshot> GetAsync(CancellationToken ct);
}
