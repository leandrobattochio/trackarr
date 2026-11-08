using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;
using TrackerStats.Infrastructure.Plugins.Storage;

namespace TrackerStats.Infrastructure.Data;

public enum DatabaseEngine
{
    Sqlite,
    PostgreSql
}

public sealed class AppDatabase
{
    private AppDatabase(DatabaseEngine engine, string connectionString, string? sqliteFilePath)
    {
        Engine = engine;
        ConnectionString = connectionString;
        SqliteFilePath = sqliteFilePath;
    }

    public const string PostgresConnectionName = "PostgresConnection";
    public const string SqliteFileName = "trackarr.db";

    public DatabaseEngine Engine { get; }
    // Holds the Postgres password: keep this type a class, since a record's ToString would print it.
    public string ConnectionString { get; }
    public string? SqliteFilePath { get; }

    public static AppDatabase FromConfiguration(IConfiguration configuration, IHostEnvironment hostEnvironment)
    {
        var postgresConnectionString = configuration.GetConnectionString(PostgresConnectionName);
        if (!string.IsNullOrWhiteSpace(postgresConnectionString))
            return new AppDatabase(DatabaseEngine.PostgreSql, postgresConnectionString, null);

        var dataDirectory = new PluginStorageLayout(configuration, hostEnvironment).DataDirectory;
        var filePath = Path.Combine(dataDirectory, SqliteFileName);
        var connectionString = new SqliteConnectionStringBuilder
        {
            DataSource = filePath,
            Mode = SqliteOpenMode.ReadWriteCreate,
            Pooling = true
        }.ToString();
        return new AppDatabase(DatabaseEngine.Sqlite, connectionString, filePath);
    }

    public void Register(IServiceCollection services)
    {
        if (Engine == DatabaseEngine.PostgreSql)
        {
            services.AddDbContext<PostgresAppDbContext>(options => options.UseNpgsql(ConnectionString));
            services.TryAddSingleton(new PostgresStartupRetryPolicy());
            services.AddScoped<AppDbContext>(provider => provider.GetRequiredService<PostgresAppDbContext>());
            return;
        }

        services.AddDbContext<SqliteAppDbContext>(options => options
            .UseSqlite(ConnectionString)
            .AddInterceptors(new SqlitePragmaInterceptor()));
        services.AddScoped<AppDbContext>(provider => provider.GetRequiredService<SqliteAppDbContext>());
    }

    public async Task MigrateAsync(IServiceProvider services, ILogger logger, CancellationToken ct = default)
    {
        var database = services.GetRequiredService<AppDbContext>().Database;
        if (Engine == DatabaseEngine.Sqlite)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(SqliteFilePath)!);
            try
            {
                await database.MigrateAsync(ct);
            }
            catch (SqliteException exception) when (IsCorruptFileError(exception))
            {
                throw new DatabaseStartupException(
                    $"Database file {SqliteFilePath} is corrupt. Restore it from a backup, or delete it to start over.",
                    exception);
            }
            return;
        }

        var builder = new NpgsqlConnectionStringBuilder(ConnectionString);
        await services.GetRequiredService<PostgresStartupRetryPolicy>().ExecuteAsync(async token =>
        {
            await EnsurePostgresDatabaseExistsAsync(builder, token);
            await database.MigrateAsync(token);
        }, $"{builder.Host}:{builder.Port}", logger, ct);
    }

    private const int SqliteCorrupt = 11;
    private const int SqliteNotADatabase = 26;

    // The low byte is the primary result code, also when SQLite reports an extended one.
    private static bool IsCorruptFileError(SqliteException exception) =>
        (exception.SqliteErrorCode & 0xFF) is SqliteCorrupt or SqliteNotADatabase;

    // Npgsql's MigrateAsync would create a missing database; trackarr leaves that to the user.
    private async Task EnsurePostgresDatabaseExistsAsync(NpgsqlConnectionStringBuilder builder, CancellationToken ct)
    {
        try
        {
            await using var connection = new NpgsqlConnection(ConnectionString);
            await connection.OpenAsync(ct);
        }
        catch (PostgresException exception) when (exception.SqlState == PostgresErrorCodes.InvalidCatalogName)
        {
            throw new DatabaseStartupException(
                $"PostgreSQL database '{builder.Database ?? builder.Username}' does not exist. trackarr does not create it: " +
                "create it, or remove ConnectionStrings__PostgresConnection to use SQLite.",
                exception);
        }
    }

    public async Task LogEngineAsync(DatabaseFacade database, ILogger logger, CancellationToken ct = default)
    {
        var version = await GetEngineVersionAsync(database, ct);
        if (Engine == DatabaseEngine.PostgreSql)
            logger.LogInformation("Database: PostgreSQL {Version}", version);
        else
            logger.LogInformation("Database: SQLite {Version} at {Path}", version, SqliteFilePath);
    }

    private async Task<string> GetEngineVersionAsync(DatabaseFacade database, CancellationToken ct)
    {
        await database.OpenConnectionAsync(ct);
        try
        {
            await using var command = database.GetDbConnection().CreateCommand();
            command.CommandText = Engine == DatabaseEngine.PostgreSql ? "SHOW server_version" : "SELECT sqlite_version()";
            return Convert.ToString(await command.ExecuteScalarAsync(ct)) ?? string.Empty;
        }
        finally
        {
            await database.CloseConnectionAsync();
        }
    }
}
