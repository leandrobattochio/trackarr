using TrackerStats.Domain.Plugins.Yaml;

namespace TrackerStats.Infrastructure.Plugins.Yaml;

public static class BuiltInYamlPluginDefinitions
{
    private const string ChromeUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";

    public static IReadOnlyList<PluginDefinition> CreateAll() =>
    [
        CreateBjShare(),
        CreateFearnopeer(),
        CreateSeedpool()
    ];

    private static PluginDefinition CreateBjShare() =>
        new()
        {
            PluginId = "bj-share",
            PluginGroup = "bj-share",
            DisplayName = "BJ-Share",
            Fields =
            [
                new() { Name = "cron", Label = "Cron Expression", Type = "cron", Required = true },
                new() { Name = "required_ratio", Label = "Required Ratio", Type = "number", Required = true },
                new() { Name = "baseUrl", Label = "Base URL", Type = "text", Required = true },
                new() { Name = "cookie", Label = "Cookie", Type = "text", Required = true, Sensitive = true },
                new() { Name = "username", Label = "User Name", Type = "text", Required = true }
            ],
            Http = new HttpConfig
            {
                BaseUrl = "{{baseUrl}}",
                Headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    ["Accept"] = "application/json",
                    ["User-Agent"] = ChromeUserAgent,
                    ["Cookie"] = "{{cookie}}"
                }
            },
            AuthFailure = new AuthFailureConfig
            {
                HttpStatusCodes = [401, 403],
                HtmlPatterns = ["Login", "login.php", "name=\"password\"", "type=\"password\""]
            },
            Steps =
            [
                new()
                {
                    Name = "profile",
                    Method = "POST",
                    Url = "user.php?username={{username}}",
                    ResponseType = "html",
                    Extract = new Dictionary<string, ExtractionRule>(StringComparer.OrdinalIgnoreCase)
                    {
                        ["uploadedBytes"] = new() { Regex = "<li\\s+class=\"tooltip\"\\s+title=\"(?<value>[^\"]+)\">\\s*Enviado:", Transform = "byteSize" },
                        ["downloadedBytes"] = new() { Regex = "<li\\s+class=\"tooltip\"\\s+title=\"(?<value>[^\"]+)\">\\s*Baixado:", Transform = "byteSize" },
                        ["ratio"] = new() { Regex = "Ratio:\\s*<span[^>]*title=\"(?<value>[^\"]+)\"", Transform = "decimal" },
                        ["seedBonus"] = new() { Regex = "BJ-Pontos\\s*:\\s*(?<value>[\\d\\.,]+)", Transform = "integer" }
                    }
                },
                new()
                {
                    Name = "seeding",
                    Method = "GET",
                    Url = "torrents.php?type=seeding&username={{username}}",
                    ResponseType = "html",
                    Extract = new Dictionary<string, ExtractionRule>(StringComparer.OrdinalIgnoreCase)
                    {
                        ["seedingTorrents"] = new() { Regex = "<tr[^>]*class=\"[^\"]*torrent[^\"]*torrent_row[^\"]*\"[^>]*>", CountMatches = true }
                    }
                },
                new()
                {
                    Name = "leeching",
                    Method = "GET",
                    Url = "torrents.php?type=leeching&username={{username}}",
                    ResponseType = "html",
                    Extract = new Dictionary<string, ExtractionRule>(StringComparer.OrdinalIgnoreCase)
                    {
                        ["leechingTorrents"] = new() { Regex = "<tr[^>]*class=\"[^\"]*torrent[^\"]*torrent_row[^\"]*\"[^>]*>", CountMatches = true }
                    }
                }
            ],
            Mapping = new MappingConfig
            {
                Ratio = "steps.profile.ratio",
                UploadedBytes = "steps.profile.uploadedBytes",
                DownloadedBytes = "steps.profile.downloadedBytes",
                SeedBonus = "steps.profile.seedBonus",
                RequiredRatio = "fields.required_ratio",
                SeedingTorrents = "steps.seeding.seedingTorrents",
                LeechingTorrents = "steps.leeching.leechingTorrents",
                ActiveTorrents = "steps.seeding.seedingTorrents + steps.leeching.leechingTorrents"
            }
        };

    private static PluginDefinition CreateFearnopeer() =>
        CreateUnit3DPluginDefinition("fearnopeer", "Fearnopeer");

    private static PluginDefinition CreateSeedpool() =>
        CreateUnit3DPluginDefinition("seedpool", "Seedpool");

    private static PluginDefinition CreateUnit3DPluginDefinition(string pluginId, string displayName) =>
        new()
        {
            PluginId = pluginId,
            PluginGroup = "unit3d",
            DisplayName = displayName,
            Fields =
            [
                new() { Name = "cron", Label = "Cron Expression", Type = "cron", Required = true },
                new() { Name = "required_ratio", Label = "Required Ratio", Type = "number", Required = true },
                new() { Name = "baseUrl", Label = "Base URL", Type = "text", Required = true },
                new() { Name = "apiKey", Label = "API Key", Type = "password", Required = true, Sensitive = true }
            ],
            Http = new HttpConfig
            {
                BaseUrl = "{{baseUrl}}",
                Headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    ["Accept"] = "application/json",
                    ["User-Agent"] = ChromeUserAgent
                }
            },
            AuthFailure = new AuthFailureConfig
            {
                HttpStatusCodes = [401, 403]
            },
            Steps =
            [
                new()
                {
                    Name = "user",
                    Method = "GET",
                    Url = "api/user?api_token={{apiKey}}",
                    ResponseType = "json",
                    Extract = new Dictionary<string, ExtractionRule>(StringComparer.OrdinalIgnoreCase)
                    {
                        ["username"] = new() { Path = "username", Transform = "toString" },
                        ["uploaded"] = new() { Path = "uploaded", Transform = "byteSize" },
                        ["downloaded"] = new() { Path = "downloaded", Transform = "byteSize" },
                        ["ratio"] = new() { Path = "ratio", Transform = "decimal" },
                        ["buffer"] = new() { Path = "buffer", Transform = "toString" },
                        ["seeding"] = new() { Path = "seeding", Transform = "integer" },
                        ["leeching"] = new() { Path = "leeching", Transform = "integer" },
                        ["seedbonus"] = new() { Path = "seedbonus", Transform = "toString" },
                        ["hit_and_runs"] = new() { Path = "hit_and_runs", Transform = "integer" }
                    },
                    Validate =
                    [
                        new() { Field = "username", Rule = "notEmpty", OnFail = "unknownError" }
                    ]
                }
            ],
            Mapping = new MappingConfig
            {
                Ratio = "steps.user.ratio",
                UploadedBytes = "steps.user.uploaded",
                DownloadedBytes = "steps.user.downloaded",
                SeedBonus = "steps.user.seedbonus",
                Buffer = "steps.user.buffer",
                HitAndRuns = "steps.user.hit_and_runs",
                RequiredRatio = "fields.required_ratio",
                SeedingTorrents = "steps.user.seeding",
                LeechingTorrents = "steps.user.leeching",
                ActiveTorrents = "steps.user.seeding + steps.user.leeching"
            }
        };
}
