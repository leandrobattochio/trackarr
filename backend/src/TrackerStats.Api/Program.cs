using System.Data.Common;
using FluentValidation;
using Hangfire;
using Hangfire.Storage.SQLite;
using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;
using TrackerStats.Api.Controllers;
using TrackerStats.Domain.Plugins;
using TrackerStats.Domain.Plugins.Yaml;
using TrackerStats.Domain.Repositories;
using TrackerStats.Domain.Services;
using TrackerStats.Infrastructure.Data;
using TrackerStats.Infrastructure.Plugins;
using TrackerStats.Infrastructure.Plugins.Yaml;
using TrackerStats.Infrastructure.Repositories;
using TrackerStats.Infrastructure.Services;
using TrackerStats.PluginEngine;
using TrackerStats.PluginEngine.Extraction;
using TrackerStats.PluginEngine.Transforms;

var builder = WebApplication.CreateBuilder(args);
var postgresConnectionString = builder.Configuration.GetConnectionString("PostgresConnection");
if (string.IsNullOrWhiteSpace(postgresConnectionString))
    throw new InvalidOperationException("Connection string 'PostgresConnection' was not found.");

var hangfireConnectionString = ResolveHangfireConnectionString(builder.Configuration, builder.Environment);
var hangfireDatabasePath = ResolveSqliteDatabasePath(hangfireConnectionString, "hangfire.db");

builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddValidatorsFromAssemblyContaining<CreateIntegrationRequestValidator>();

builder.Services.AddDbContext<AppDbContext>(opts =>
{
    opts.UseNpgsql(postgresConnectionString);
});

builder.Services.AddHangfire(config => config
    .UseSimpleAssemblyNameTypeSerializer()
    .UseRecommendedSerializerSettings()
    .UseSQLiteStorage(hangfireDatabasePath));
builder.Services.AddHangfireServer();

builder.Services.AddHttpClient();
builder.Services.AddHttpClient("github-releases", client =>
{
    client.BaseAddress = new Uri("https://api.github.com");
    client.DefaultRequestHeaders.UserAgent.ParseAdd("TrackArr");
    client.Timeout = TimeSpan.FromSeconds(5);
});
builder.Services.AddScoped<IIntegrationRepository, IntegrationRepository>();
builder.Services.AddScoped<IIntegrationSnapshotRepository, IntegrationSnapshotRepository>();
builder.Services.AddSingleton<IApplicationSettingsService, ApplicationSettingsService>();
builder.Services.AddSingleton<IUpdateCheckService, GitHubUpdateCheckService>();
builder.Services.AddScoped<IAboutService, AboutService>();
builder.Services.AddSingleton<ITrackerPluginHttpClientFactory, TrackerPluginHttpClientFactory>();
builder.Services.AddSingleton<IntegrationConfigurationValidator>();
builder.Services.AddScoped<IntegrationSyncService>();
builder.Services.AddScoped<IntegrationRecurringSyncJob>();
builder.Services.AddSingleton<IntegrationRecurringJobScheduler>();
builder.Services.AddHostedService<IntegrationRecurringJobsBootstrapper>();

builder.Services.AddSingleton<IExtractionStrategy, CountMatchesExtractionStrategy>();
builder.Services.AddSingleton<IExtractionStrategy, RegexExtractionStrategy>();
builder.Services.AddSingleton<IExtractionStrategy, JsonPathExtractionStrategy>();
builder.Services.AddSingleton<ITransformStrategy, ByteSizeTransformStrategy>();
builder.Services.AddSingleton<ITransformStrategy, DecimalTransformStrategy>();
builder.Services.AddSingleton<ITransformStrategy, IntegerTransformStrategy>();
builder.Services.AddSingleton<ITransformStrategy, ToStringTransformStrategy>();
builder.Services.AddSingleton<ITemplateInterpolator, TemplateInterpolator>();
builder.Services.AddSingleton<IAuthFailureDetector, AuthFailureDetector>();
builder.Services.AddSingleton<IResultMapper, ResultMapper>();
builder.Services.AddSingleton<IYamlPluginEngine, YamlPluginEngine>();
builder.Services.AddSingleton<IYamlPluginDefinitionLoader, YamlPluginDefinitionLoader>();
builder.Services.AddSingleton<ITrackerPluginRegistry, TrackerPluginRegistry>();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
    await db.EnsureSeedDataAsync();
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
    app.UseHangfireDashboard("/hangfire");
}

if (app.Environment.IsProduction())
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

app.UseAuthorization();
app.MapControllers();

if (app.Environment.IsProduction())
{
    app.MapFallback(async context =>
    {
        if (context.Request.Path.StartsWithSegments("/api"))
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }

        await context.Response.SendFileAsync(Path.Combine(app.Environment.WebRootPath!, "index.html"));
    });
}

app.Run();

static string ResolveHangfireConnectionString(
    IConfiguration configuration,
    IHostEnvironment environment)
{
    var connectionString = configuration.GetConnectionString("HangfireConnection")
        ?? throw new InvalidOperationException("Connection string 'HangfireConnection' was not found.");

    if (!environment.IsProduction())
        return connectionString;

    var databaseDirectory = configuration["Hangfire:Directory"];
    if (string.IsNullOrWhiteSpace(databaseDirectory))
        return connectionString;

    Directory.CreateDirectory(databaseDirectory);

    var builder = new DbConnectionStringBuilder
    {
        ConnectionString = connectionString
    };

    var dataSourceKey = builder.ContainsKey("Data Source")
        ? "Data Source"
        : builder.ContainsKey("DataSource")
            ? "DataSource"
            : "Data Source";

    var currentDataSource = builder.TryGetValue(dataSourceKey, out var value)
        ? value?.ToString()
        : null;

    var databaseFileName = string.IsNullOrWhiteSpace(currentDataSource)
        ? "hangfire.db"
        : Path.GetFileName(currentDataSource);

    builder[dataSourceKey] = Path.Combine(databaseDirectory, databaseFileName);
    return builder.ConnectionString;
}

static string ResolveSqliteDatabasePath(string connectionString, string fallbackFileName)
{
    var builder = new DbConnectionStringBuilder
    {
        ConnectionString = connectionString
    };

    var dataSourceKey = builder.ContainsKey("Data Source")
        ? "Data Source"
        : builder.ContainsKey("DataSource")
            ? "DataSource"
            : "Data Source";

    var dataSource = builder.TryGetValue(dataSourceKey, out var value)
        ? value?.ToString()
        : null;

    return string.IsNullOrWhiteSpace(dataSource)
        ? fallbackFileName
        : dataSource;
}

public partial class Program;
