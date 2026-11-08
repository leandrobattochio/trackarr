using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace TrackerStats.Infrastructure.Data;

public sealed class SqlitePragmaInterceptor : DbConnectionInterceptor
{
    // Microsoft.Data.Sqlite has no connection-string keys for these.
    private const string Pragmas = "PRAGMA journal_mode = WAL; PRAGMA cache_size = -20000; PRAGMA busy_timeout = 1000;";

    public override void ConnectionOpened(DbConnection connection, ConnectionEndEventData eventData)
    {
        using var command = connection.CreateCommand();
        command.CommandText = Pragmas;
        command.ExecuteNonQuery();
    }

    public override async Task ConnectionOpenedAsync(
        DbConnection connection,
        ConnectionEndEventData eventData,
        CancellationToken cancellationToken = default)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = Pragmas;
        await command.ExecuteNonQueryAsync(cancellationToken);
    }
}
