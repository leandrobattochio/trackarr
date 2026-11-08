using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace TrackerStats.Infrastructure.Data;

public class PostgresAppDbContext(DbContextOptions<PostgresAppDbContext> options) : AppDbContext(options);

public class PostgresAppDbContextFactory : IDesignTimeDbContextFactory<PostgresAppDbContext>
{
    public PostgresAppDbContext CreateDbContext(string[] args) =>
        new(new DbContextOptionsBuilder<PostgresAppDbContext>()
            .UseNpgsql("Host=localhost;Database=trackarr")
            .Options);
}
