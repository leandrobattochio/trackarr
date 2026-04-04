using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using TrackerStats.Domain.Entities;

namespace TrackerStats.Infrastructure.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Integration> Integrations => Set<Integration>();
    public DbSet<IntegrationSnapshot> IntegrationSnapshots => Set<IntegrationSnapshot>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var utcDateTimeConverter = new ValueConverter<DateTime, DateTime>(
            value => value.Kind == DateTimeKind.Utc ? value : value.ToUniversalTime(),
            value => DateTime.SpecifyKind(value, DateTimeKind.Utc));

        var nullableUtcDateTimeConverter = new ValueConverter<DateTime?, DateTime?>(
            value => value.HasValue
                ? value.Value.Kind == DateTimeKind.Utc
                    ? value.Value
                    : value.Value.ToUniversalTime()
                : value,
            value => value.HasValue
                ? DateTime.SpecifyKind(value.Value, DateTimeKind.Utc)
                : value);

        modelBuilder.Entity<Integration>()
            .Property(i => i.LastSyncResult)
            .HasConversion<string>();

        modelBuilder.Entity<Integration>()
            .Property(i => i.LastSyncAt)
            .HasConversion(nullableUtcDateTimeConverter);

        modelBuilder.Entity<IntegrationSnapshot>()
            .Property(s => s.CapturedAt)
            .HasConversion(utcDateTimeConverter);
    }
}
