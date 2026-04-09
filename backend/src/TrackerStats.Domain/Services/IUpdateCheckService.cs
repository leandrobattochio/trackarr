namespace TrackerStats.Domain.Services;

public interface IUpdateCheckService
{
    Task<UpdateCheckSnapshot> CheckAsync(string currentVersion, CancellationToken ct);
}
