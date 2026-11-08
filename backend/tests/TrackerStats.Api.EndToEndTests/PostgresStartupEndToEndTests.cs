using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Shouldly;
using Testcontainers.PostgreSql;
using TrackerStats.Infrastructure.Data;

namespace TrackerStats.Api.EndToEndTests;

[Trait("Database", "Postgres")]
public sealed class PostgresStartupEndToEndTests : IAsyncLifetime
{
    private const string PostgresPassword = "startup-postgres-password";

    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:17-alpine")
        .WithDatabase("trackerstats")
        .WithUsername("postgres")
        .WithPassword(PostgresPassword)
        .Build();

    private readonly string _dataDirectory = Path.Combine(Path.GetTempPath(), $"trackarr-pgstartup-{Guid.NewGuid():N}");
    private readonly LogCollector _logs = new();
    private readonly List<TimeSpan> _waits = [];

    public async Task InitializeAsync()
    {
        Directory.CreateDirectory(_dataDirectory);
        RepoPlugins.CopyToOfficial(_dataDirectory);
        await _postgres.StartAsync();
    }

    public async Task DisposeAsync()
    {
        NpgsqlConnection.ClearAllPools();
        await _postgres.DisposeAsync();
        if (Directory.Exists(_dataDirectory))
            Directory.Delete(_dataDirectory, recursive: true);
    }

    [Fact]
    public async Task A_missing_database_should_stop_startup_and_never_be_created()
    {
        var connection = new NpgsqlConnectionStringBuilder(_postgres.GetConnectionString()) { Database = "trackarr_missing" };

        var exception = await Should.ThrowAsync<DatabaseStartupException>(() => BootAsync(connection.ConnectionString));

        exception.Message.ShouldBe(
            "PostgreSQL database 'trackarr_missing' does not exist. trackarr does not create it: " +
            "create it, or remove ConnectionStrings__PostgresConnection to use SQLite.");
        exception.InnerException.ShouldBeOfType<PostgresException>().SqlState.ShouldBe("3D000");
        _waits.ShouldBeEmpty();
        (await ListDatabasesAsync()).ShouldNotContain("trackarr_missing");
        File.Exists(Path.Combine(_dataDirectory, AppDatabase.SqliteFileName)).ShouldBeFalse();
        _logs.Messages.ShouldNotContain(message => message.Contains(PostgresPassword));
    }

    [Fact]
    public async Task An_existing_empty_database_should_get_its_tables()
    {
        await using (var admin = new NpgsqlConnection(_postgres.GetConnectionString()))
        {
            await admin.OpenAsync();
            await using var create = new NpgsqlCommand("CREATE DATABASE trackarr_empty", admin);
            await create.ExecuteNonQueryAsync();
        }

        var connection = new NpgsqlConnectionStringBuilder(_postgres.GetConnectionString()) { Database = "trackarr_empty" };
        await BootAsync(connection.ConnectionString);

        await using var db = new NpgsqlConnection(connection.ConnectionString);
        await db.OpenAsync();
        await using var count = new NpgsqlCommand("SELECT count(*) FROM \"WhatsNewState\"", db);
        (await count.ExecuteScalarAsync()).ShouldBe(1L);
    }

    [Fact]
    public async Task An_unreachable_server_should_be_retried_three_times_five_seconds_apart_then_stop_startup()
    {
        var connection = new NpgsqlConnectionStringBuilder(_postgres.GetConnectionString()) { Timeout = 5 };
        var server = $"{connection.Host}:{connection.Port}";
        await _postgres.StopAsync();

        var exception = await Should.ThrowAsync<DatabaseStartupException>(() => BootAsync(connection.ConnectionString));

        exception.Message.ShouldStartWith($"Could not connect to PostgreSQL at {server} after 3 retries.");
        exception.InnerException.ShouldBeOfType<NpgsqlException>().InnerException.ShouldBeOfType<System.Net.Sockets.SocketException>();
        _waits.ShouldBe([TimeSpan.FromSeconds(5), TimeSpan.FromSeconds(5), TimeSpan.FromSeconds(5)]);
        _logs.Messages.Where(message => message.StartsWith("Failed to connect to PostgreSQL")).ShouldBe([
            $"Failed to connect to PostgreSQL at {server}, 3 retries remaining",
            $"Failed to connect to PostgreSQL at {server}, 2 retries remaining",
            $"Failed to connect to PostgreSQL at {server}, 1 retries remaining"
        ]);
        _logs.Messages.ShouldNotContain(message => message.Contains(PostgresPassword));
        File.Exists(Path.Combine(_dataDirectory, AppDatabase.SqliteFileName)).ShouldBeFalse();
    }

    private async Task<List<string>> ListDatabasesAsync()
    {
        await using var admin = new NpgsqlConnection(_postgres.GetConnectionString());
        await admin.OpenAsync();
        await using var command = new NpgsqlCommand("SELECT datname FROM pg_database", admin);
        await using var reader = await command.ExecuteReaderAsync();
        var names = new List<string>();
        while (await reader.ReadAsync())
            names.Add(reader.GetString(0));
        return names;
    }

    private Task BootAsync(string postgresConnection) =>
        TestApp.BootAsync(_dataDirectory, postgresConnection, (_, _) => Task.CompletedTask, _logs, services =>
            services.AddSingleton(new PostgresStartupRetryPolicy(wait: (delay, _) =>
            {
                _waits.Add(delay);
                return Task.CompletedTask;
            })));
}
