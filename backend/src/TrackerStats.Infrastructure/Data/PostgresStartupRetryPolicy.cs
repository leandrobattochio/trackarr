using System.Net.Sockets;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace TrackerStats.Infrastructure.Data;

public sealed class PostgresStartupRetryPolicy
{
    public const int DefaultRetries = 3;
    public static readonly TimeSpan DefaultDelay = TimeSpan.FromSeconds(5);

    private readonly Func<TimeSpan, CancellationToken, Task> _wait;

    public PostgresStartupRetryPolicy(
        int retries = DefaultRetries,
        TimeSpan? delay = null,
        Func<TimeSpan, CancellationToken, Task>? wait = null)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(retries);
        Retries = retries;
        Delay = delay ?? DefaultDelay;
        _wait = wait ?? Task.Delay;
    }

    public int Retries { get; }
    public TimeSpan Delay { get; }

    public async Task ExecuteAsync(
        Func<CancellationToken, Task> action,
        string serverName,
        ILogger logger,
        CancellationToken ct = default)
    {
        var retriesLeft = Retries;
        var retrying = false;
        while (true)
        {
            try
            {
                await action(ct);
                return;
            }
            // Once retrying, any PostgreSQL error counts: a server still starting refuses with 57P03.
            catch (NpgsqlException exception) when (retrying || IsSocketError(exception))
            {
                if (retriesLeft == 0)
                {
                    throw new DatabaseStartupException(
                        $"Could not connect to PostgreSQL at {serverName} after {Retries} retries. " +
                        "Check that the server is running and reachable, or remove " +
                        "ConnectionStrings__PostgresConnection to use SQLite.",
                        exception);
                }

                logger.LogError(exception,
                    "Failed to connect to PostgreSQL at {Server}, {RetriesLeft} retries remaining", serverName, retriesLeft);
                retriesLeft--;
                retrying = true;
                await _wait(Delay, ct);
            }
        }
    }

    private static bool IsSocketError(NpgsqlException exception) => exception.InnerException is SocketException;
}

public sealed class DatabaseStartupException(string message, Exception? innerException = null)
    : Exception(message, innerException);
