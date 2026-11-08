using System.Net.Sockets;
using Microsoft.Extensions.Logging;
using Npgsql;
using Shouldly;
using TrackerStats.Infrastructure.Data;

namespace TrackerStats.Backend.Tests;

public sealed class PostgresStartupRetryPolicyTests
{
    private const string Server = "db.example:5432";

    private readonly List<TimeSpan> _waits = [];
    private readonly ListLogger<PostgresStartupRetryPolicyTests> _logger = new();

    private PostgresStartupRetryPolicy CreatePolicy() => new(wait: (delay, _) =>
    {
        _waits.Add(delay);
        return Task.CompletedTask;
    });

    private static NpgsqlException SocketFailure() =>
        new("Failed to connect to 10.0.0.1:5432", new SocketException((int)SocketError.ConnectionRefused));

    [Fact]
    public void Defaults_should_be_three_retries_five_seconds_apart()
    {
        var policy = new PostgresStartupRetryPolicy();

        policy.Retries.ShouldBe(3);
        policy.Delay.ShouldBe(TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task Socket_errors_should_be_retried_three_times_then_fail_startup()
    {
        var attempts = 0;

        var exception = await Should.ThrowAsync<DatabaseStartupException>(() => CreatePolicy().ExecuteAsync(_ =>
        {
            attempts++;
            throw SocketFailure();
        }, Server, _logger));

        attempts.ShouldBe(4);
        _waits.ShouldBe([TimeSpan.FromSeconds(5), TimeSpan.FromSeconds(5), TimeSpan.FromSeconds(5)]);
        _logger.Entries.Select(entry => entry.Level).ShouldAllBe(level => level == LogLevel.Error);
        _logger.Entries.Select(entry => entry.Message).ShouldBe([
            $"Failed to connect to PostgreSQL at {Server}, 3 retries remaining",
            $"Failed to connect to PostgreSQL at {Server}, 2 retries remaining",
            $"Failed to connect to PostgreSQL at {Server}, 1 retries remaining"
        ]);
        exception.Message.ShouldStartWith($"Could not connect to PostgreSQL at {Server} after 3 retries.");
        exception.InnerException.ShouldBeOfType<NpgsqlException>();
    }

    [Fact]
    public async Task A_retry_that_connects_should_let_startup_continue()
    {
        var attempts = 0;

        await CreatePolicy().ExecuteAsync(_ =>
        {
            if (++attempts < 3)
                throw SocketFailure();
            return Task.CompletedTask;
        }, Server, _logger);

        attempts.ShouldBe(3);
        _waits.Count.ShouldBe(2);
        _logger.Entries.Count.ShouldBe(2);
    }

    [Fact]
    public async Task A_postgres_error_should_fail_at_once()
    {
        var attempts = 0;
        var authFailure = new PostgresException("password authentication failed", "FATAL", "FATAL", "28P01");

        var exception = await Should.ThrowAsync<PostgresException>(() => CreatePolicy().ExecuteAsync(_ =>
        {
            attempts++;
            throw authFailure;
        }, Server, _logger));

        exception.ShouldBeSameAs(authFailure);
        attempts.ShouldBe(1);
        _waits.ShouldBeEmpty();
        _logger.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task A_connection_error_without_a_socket_cause_should_fail_at_once()
    {
        var attempts = 0;

        await Should.ThrowAsync<NpgsqlException>(() => CreatePolicy().ExecuteAsync(_ =>
        {
            attempts++;
            throw new NpgsqlException("The operation has timed out", new TimeoutException());
        }, Server, _logger));

        attempts.ShouldBe(1);
        _waits.ShouldBeEmpty();
    }

    [Fact]
    public async Task A_postgres_error_during_a_retry_should_be_retried_too()
    {
        var attempts = 0;
        var startingUp = new PostgresException("the database system is starting up", "FATAL", "FATAL", "57P03");

        await CreatePolicy().ExecuteAsync(_ =>
        {
            attempts++;
            if (attempts == 1)
                throw SocketFailure();
            if (attempts == 2)
                throw startingUp;
            return Task.CompletedTask;
        }, Server, _logger);

        attempts.ShouldBe(3);
        _waits.Count.ShouldBe(2);
    }

    [Fact]
    public async Task A_startup_error_during_a_retry_should_fail_at_once()
    {
        var attempts = 0;
        var missingDatabase = new DatabaseStartupException("PostgreSQL database 'trackarr' does not exist.");

        var exception = await Should.ThrowAsync<DatabaseStartupException>(() => CreatePolicy().ExecuteAsync(_ =>
        {
            if (++attempts == 1)
                throw SocketFailure();
            throw missingDatabase;
        }, Server, _logger));

        exception.ShouldBeSameAs(missingDatabase);
        attempts.ShouldBe(2);
        _waits.Count.ShouldBe(1);
    }
}
