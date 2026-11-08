using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using TrackerStats.Domain.Entities;

namespace TrackerStats.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    protected AppDbContext(DbContextOptions options) : base(options)
    {
    }

    public const string DefaultUserAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";

    public DbSet<ApplicationSettings> ApplicationSettings => Set<ApplicationSettings>();
    public DbSet<Integration> Integrations => Set<Integration>();
    public DbSet<IntegrationSnapshot> IntegrationSnapshots => Set<IntegrationSnapshot>();
    public DbSet<WhatsNewState> WhatsNewStates => Set<WhatsNewState>();
    public DbSet<TrackerProxy> Proxies => Set<TrackerProxy>();

    public async Task EnsureSeedDataAsync(CancellationToken ct = default)
    {
        if (await ApplicationSettings.AnyAsync(static s => s.Id == 1, ct))
            return;

        ApplicationSettings.Add(new ApplicationSettings
        {
            Id = 1,
            UserAgent = DefaultUserAgent
        });

        try
        {
            await SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            var pendingSettings = ApplicationSettings.Local.SingleOrDefault(static s => s.Id == 1);
            if (pendingSettings is not null)
                Entry(pendingSettings).State = EntityState.Detached;

            if (!await ApplicationSettings.AnyAsync(static s => s.Id == 1, ct))
                throw;
        }
    }

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

        modelBuilder.Entity<ApplicationSettings>()
            .Property(settings => settings.UserAgent)
            .IsRequired();

        var proxy = modelBuilder.Entity<TrackerProxy>();
        proxy.ToTable("Proxies");
        proxy.Property(p => p.Name).IsRequired().HasMaxLength(100);
        proxy.HasIndex(p => p.Name).IsUnique();
        proxy.Property(p => p.Type).HasConversion<string>().HasMaxLength(16);
        proxy.Property(p => p.Host).IsRequired().HasMaxLength(255);
        proxy.Property(p => p.Username).HasMaxLength(255);
        proxy.Property(p => p.Password).HasMaxLength(255);

        modelBuilder.Entity<Integration>()
            .HasOne(i => i.Proxy)
            .WithMany()
            .HasForeignKey(i => i.ProxyId)
            .OnDelete(DeleteBehavior.Restrict);

        var whatsNew = modelBuilder.Entity<WhatsNewState>();
        whatsNew.ToTable("WhatsNewState");
        whatsNew.Property(state => state.Id).ValueGeneratedNever();
        whatsNew.Property(state => state.LastReadAt).HasConversion(nullableUtcDateTimeConverter);
        whatsNew.HasData(new WhatsNewState { Id = WhatsNewState.SingletonId });
    }
}
