using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;
using TrackerStats.Domain.Plugins.Yaml;
using TrackerStats.Domain.Repositories;
using TrackerStats.Infrastructure.Plugins.Source;
using TrackerStats.Infrastructure.Plugins.Storage;
using TrackerStats.Infrastructure.Plugins.Yaml;
using TrackerStats.PluginValidator;

namespace TrackerStats.Backend.Tests;

public sealed class PluginBaseTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), $"trackerstats-bases-{Guid.NewGuid():N}");
    private readonly string _sourceDirectory;
    private readonly PluginStorageLayout _layout;
    private readonly PluginStateStore _stateStore;
    private readonly PluginBaseStore _bases;

    public PluginBaseTests()
    {
        _sourceDirectory = Path.Combine(_root, "source");
        _layout = PluginStorageLayout.ForDataDirectory(Path.Combine(_root, "data"));
        _stateStore = new PluginStateStore(_layout);
        _bases = new PluginBaseStore(_layout);
    }

    [Fact]
    public void A_plugin_without_extends_should_be_left_as_it_is()
    {
        var yaml = ChildYaml("tracker").Replace("extends: shared\n", "");

        var resolution = PluginBaseResolver.Resolve(yaml, _bases);

        resolution.Succeeded.ShouldBeTrue();
        resolution.Yaml.ShouldBe(yaml);
    }

    [Fact]
    public void A_plugin_should_inherit_every_key_it_does_not_set_and_replace_the_ones_it_sets()
    {
        InstallBase(BaseYaml());
        var child = ChildYaml("tracker") + """
            dashboard:
              metrics:
                - stat: uploadedBytes
                  label: Up
                  format: bytes

            """;

        var validation = PluginDefinitionValidator.Validate(child, requireSchemaVersion: true, requireVersion: true, bases: _bases);

        validation.Error.ShouldBeNull();
        var definition = validation.Definition!;
        definition.Extends.ShouldBe("shared");
        definition.PluginId.ShouldBe("tracker");
        definition.BaseUrls.ShouldBe(["https://tracker.test/"]);
        definition.Fields.ShouldHaveSingleItem().Name.ShouldBe("apiKey");
        definition.Http!.Headers["Accept"].ShouldBe("application/json");
        definition.Dashboard.Metrics.ShouldHaveSingleItem().Label.ShouldBe("Up");
        var step = definition.Steps.ShouldHaveSingleItem();
        step.Url.ShouldBe("api/user?api_token={{apiKey}}");
        step.Extract!["ratio"].Regex.ShouldBe("<li\\s+class=\"ratio\">(?<value>[^\"]+)</li>", "escapes survive the merge");
    }

    [Fact]
    public void A_plugin_extending_a_missing_base_should_be_invalid()
    {
        var validation = PluginDefinitionValidator.Validate(ChildYaml("tracker"), bases: _bases);

        validation.Error.ShouldBe("The plugin extends base 'shared', which is not installed.");
    }

    [Fact]
    public void Extends_should_require_schema_version_two()
    {
        InstallBase(BaseYaml());

        var validation = PluginDefinitionValidator.Validate(
            ChildYaml("tracker").Replace("schemaVersion: 2", "schemaVersion: 1"), bases: _bases);

        validation.Error.ShouldBe("Property 'extends' requires 'schemaVersion: 2' or later.");
        PluginDefinitionValidator.Validate(ChildYaml("tracker").Replace("schemaVersion: 2", "schemaVersion: 1").Replace("shared", "missing"))
            .Error.ShouldBe("Property 'extends' requires 'schemaVersion: 2' or later.", "the schema is the problem, not the missing base");
    }

    [Fact]
    public void A_syntax_error_in_a_plugin_that_extends_a_base_should_point_at_the_line_as_written()
    {
        InstallBase(BaseYaml());
        var child = "# comment\n\n" + ChildYaml("tracker").Replace("displayName:", "dispalyName:");

        var error = PluginDefinitionValidator.Validate(child, bases: _bases).Error;

        error.ShouldNotBeNull().ShouldContain("(line 4, column 1)");
    }

    [Theory]
    [InlineData("baseUrls:\n  - https://tracker.test/\n", "Property 'baseUrls' is not allowed in a plugin base.")]
    [InlineData("extends: other\n", "Property 'extends' is not allowed in a plugin base.")]
    public void A_base_should_reject_keys_that_belong_to_a_plugin(string extra, string expectedError)
    {
        PluginBaseValidator.Validate(BaseYaml() + extra).Error.ShouldNotBeNull().ShouldStartWith(expectedError);
    }

    [Fact]
    public void A_base_should_be_complete()
    {
        var withoutSteps = BaseYaml()[..BaseYaml().IndexOf("steps:", StringComparison.Ordinal)];

        PluginBaseValidator.Validate(withoutSteps).Error
            .ShouldBe("A plugin that extends it is invalid: Plugin definition is missing required field 'steps'.");
    }

    [Fact]
    public void A_base_should_need_schema_version_two()
    {
        PluginBaseValidator.Validate(BaseYaml().Replace("schemaVersion: 2", "schemaVersion: 1")).Error
            .ShouldBe("A plugin base needs 'schemaVersion: 2' or later.");
    }

    [Fact]
    public void The_loader_should_resolve_extends_from_the_installed_bases()
    {
        WritePlugin(PluginOrigin.Official, "tracker", ChildYaml("tracker"));
        WritePlugin(PluginOrigin.Custom, "mine", ChildYaml("mine"));

        var withoutBase = Load();
        withoutBase.ShouldAllBe(plugin => !plugin.IsValid);
        withoutBase.First().Error.ShouldNotBeNull().ShouldContain("extends base 'shared', which is not installed");

        InstallBase(BaseYaml());
        var loaded = Load();

        loaded.ShouldAllBe(plugin => plugin.IsValid);
        loaded.Select(plugin => plugin.Definition!.Steps.Single().Name).ShouldBe(["user", "user"]);
        loaded.First(plugin => plugin.PluginId == "tracker").RawContent.ShouldBe(ChildYaml("tracker"), "the editor shows the file as written");
    }

    [Fact]
    public void Saving_an_unchanged_plugin_that_extends_a_base_should_create_no_override()
    {
        InstallBase(BaseYaml());
        var official = ChildYaml("tracker");
        WritePlugin(PluginOrigin.Official, "tracker", official);
        _stateStore.Update(state => state.Official["tracker"] = new OfficialPluginState("1.0.0", PluginStateStore.ComputeSha256(Encoding.UTF8.GetBytes(official))));
        var overrides = new PluginOverrideService(_layout, _stateStore, _bases, NullLogger<PluginOverrideService>.Instance);

        overrides.SaveOfficialEdit("tracker", official.Replace("pluginId: tracker", "# a comment\npluginId: tracker"));

        File.Exists(_layout.GetPluginPath(PluginOrigin.Override, "tracker")).ShouldBeFalse();
        PluginDefinitionComparer.AreSemanticallyEqual(
            official,
            official.Replace("extends: shared\n", "") + BaseYaml()[BaseYaml().IndexOf("fields:", StringComparison.Ordinal)..],
            _bases).ShouldBeFalse("a plugin that does not extend the base declares a different 'extends'");
    }

    [Fact]
    public void The_index_parser_should_read_the_optional_bases()
    {
        var index = PluginIndexParser.Parse(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new
        {
            plugins = new[] { Entry("tracker", "plugins/tracker.yaml", 2) },
            bases = new[] { Entry("shared", "bases/shared.yaml", 2) }
        })));

        index.Plugins.ShouldHaveSingleItem().Id.ShouldBe("tracker");
        index.Bases.ShouldHaveSingleItem().Path.ShouldBe("bases/shared.yaml");
        PluginIndexParser.Parse(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new { plugins = new[] { Entry("tracker", "plugins/tracker.yaml", 1) } })))
            .Bases.ShouldBeEmpty();
        Should.Throw<FormatException>(() => PluginIndexParser.Parse(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new
        {
            plugins = new[] { Entry("tracker", "plugins/tracker.yaml", 1) },
            bases = new[] { Entry("shared", "bases/shared.yaml", 2), Entry("shared", "bases/shared.yaml", 2) }
        })))).Message.ShouldBe("index.json lists base 'shared' more than once.");
    }

    [Fact]
    public async Task The_download_should_install_the_bases_before_the_plugins_that_extend_them()
    {
        Publish(bases: [("shared", BaseYaml())], plugins: [("tracker", ChildYaml("tracker"))]);

        var report = await RunAsync();

        report.Succeeded.ShouldBeTrue(report.Error);
        report.Bases.ShouldNotBeNull().ShouldHaveSingleItem().Outcome.ShouldBe(PluginDownloadOutcome.Installed);
        report.Plugins.ShouldHaveSingleItem().Outcome.ShouldBe(PluginDownloadOutcome.Installed);
        File.ReadAllText(_layout.GetBasePath("shared")).ShouldBe(BaseYaml());
        var state = _stateStore.Load();
        state.Bases["shared"].Version.ShouldBe("1.0.0");
        state.Updates.ShouldBeEmpty("a first download is not an update");
        Load().ShouldHaveSingleItem().IsValid.ShouldBeTrue();
    }

    [Fact]
    public async Task A_base_update_should_be_recorded_for_whats_new_and_reach_the_plugins_without_a_plugin_update()
    {
        Publish(bases: [("shared", BaseYaml())], plugins: [("tracker", ChildYaml("tracker"))]);
        await RunAsync();
        var updatedBase = BaseYaml("1.1.0").Replace("label: Ratio", "label: Share ratio");
        Publish(bases: [("shared", updatedBase)], plugins: [("tracker", ChildYaml("tracker"))]);

        var report = await RunAsync();

        report.Bases!.ShouldHaveSingleItem().Outcome.ShouldBe(PluginDownloadOutcome.Updated);
        report.Plugins.ShouldHaveSingleItem().Outcome.ShouldBe(PluginDownloadOutcome.Unchanged);
        var update = _stateStore.Load().Updates.ShouldHaveSingleItem();
        update.IsBase.ShouldBeTrue();
        update.PluginId.ShouldBe("shared");
        update.DisplayName.ShouldBe("Shared");
        (update.FromVersion, update.ToVersion).ShouldBe(("1.0.0", "1.1.0"));
        Load().Single().Definition!.Dashboard.Metrics.Single().Label.ShouldBe("Share ratio");
    }

    [Fact]
    public async Task A_rejected_base_should_keep_the_installed_one_and_reject_new_plugins_that_need_it()
    {
        Publish(bases: [("shared", BaseYaml().Replace("baseId: shared", "baseId: other"))], plugins: [("tracker", ChildYaml("tracker"))]);

        var report = await RunAsync();

        var baseResult = report.Bases!.ShouldHaveSingleItem();
        baseResult.Outcome.ShouldBe(PluginDownloadOutcome.Failed);
        baseResult.Message.ShouldNotBeNull().ShouldContain("declares baseId 'other'");
        var plugin = report.Plugins.ShouldHaveSingleItem();
        plugin.Outcome.ShouldBe(PluginDownloadOutcome.Failed);
        plugin.Message.ShouldNotBeNull().ShouldContain("extends base 'shared', which is not installed");
        File.Exists(_layout.GetBasePath("shared")).ShouldBeFalse();
    }

    [Fact]
    public async Task A_base_needing_a_newer_schema_should_be_incompatible()
    {
        Publish(bases: [("shared", BaseYaml())], plugins: [("tracker", ChildYaml("tracker"))],
            baseSchemaVersion: PluginSchema.SupportedPluginSchemaVersion + 1);

        var report = await RunAsync();

        report.Succeeded.ShouldBeTrue(report.Error);
        report.Bases!.ShouldHaveSingleItem().Outcome.ShouldBe(PluginDownloadOutcome.Incompatible);
        File.Exists(_layout.GetBasePath("shared")).ShouldBeFalse();
    }

    [Fact]
    public void The_snapshot_should_seed_the_bases_of_an_install_that_already_has_plugins()
    {
        WritePlugin(PluginOrigin.Official, "existing", ChildYaml("existing"));
        Publish(bases: [("shared", BaseYaml())], plugins: [("tracker", ChildYaml("tracker"))]);
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { [PluginSnapshotSeeder.SnapshotDirectoryKey] = _sourceDirectory })
            .Build();

        var seeded = new PluginSnapshotSeeder(configuration, _layout, _stateStore, NullLogger<PluginSnapshotSeeder>.Instance).Run();

        seeded.ShouldBeEmpty("official/ already had plugins");
        File.ReadAllText(_layout.GetBasePath("shared")).ShouldBe(BaseYaml());
        File.Exists(_layout.GetPluginPath(PluginOrigin.Official, "tracker")).ShouldBeFalse();
        _stateStore.Load().Bases["shared"].Version.ShouldBe("1.0.0");
    }

    [Fact]
    public void The_validator_cli_should_check_the_bases_and_resolve_extends_with_the_bases_option()
    {
        Publish(bases: [("shared", BaseYaml())], plugins: [("tracker", ChildYaml("tracker"))]);
        var pluginPath = Path.Combine(_sourceDirectory, "plugins", "tracker.yaml");
        var basesPath = Path.Combine(_sourceDirectory, "bases");

        var (exitCode, output, _) = RunCli("--bases", basesPath, pluginPath);
        exitCode.ShouldBe(PluginValidatorCli.Success);
        output.ShouldContain($"OK      {Path.Combine(basesPath, "shared.yaml")}");
        output.ShouldContain($"OK      {pluginPath}");

        var (withoutBases, _, error) = RunCli(pluginPath);
        withoutBases.ShouldBe(PluginValidatorCli.InvalidFiles);
        error.ShouldContain("Pass the bases folder with --bases.");

        File.WriteAllText(Path.Combine(basesPath, "shared.yaml"), BaseYaml().Replace("baseId: shared", "baseId: other"));
        var (wrongName, _, nameError) = RunCli("--bases", basesPath);
        wrongName.ShouldBe(PluginValidatorCli.InvalidFiles);
        nameError.ShouldContain("File name 'shared' must equal baseId 'other'.");
    }

    private static (int ExitCode, string Output, string Error) RunCli(params string[] args)
    {
        using var output = new StringWriter();
        using var error = new StringWriter();
        var exitCode = PluginValidatorCli.Run(args, output, error);
        return (exitCode, output.ToString(), error.ToString());
    }

    private IReadOnlyList<LoadedYamlPluginDefinition> Load() =>
        new YamlPluginDefinitionLoader(_layout, _bases, new FakeApplicationSettingsService()).LoadDefinitions();

    private Task<PluginDownloadReport> RunAsync()
    {
        var services = new ServiceCollection().AddSingleton<IIntegrationRepository>(new InMemoryIntegrationRepository()).BuildServiceProvider();
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { [PluginIndexClient.SourceUrlKey] = new Uri(_sourceDirectory).AbsoluteUri })
            .Build();
        var client = new PluginIndexClient(
            configuration,
            new StubHttpClientFactory(new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.NotFound))),
            NullLogger<PluginIndexClient>.Instance);
        return new PluginDownloadService(
            client,
            _layout,
            _stateStore,
            _bases,
            new PluginOverrideService(_layout, _stateStore, _bases, NullLogger<PluginOverrideService>.Instance),
            services.GetRequiredService<IServiceScopeFactory>(),
            NullLogger<PluginDownloadService>.Instance).RunAsync();
    }

    private void Publish(
        (string Id, string Content)[] bases,
        (string Id, string Content)[] plugins,
        int baseSchemaVersion = 2)
    {
        if (Directory.Exists(_sourceDirectory))
            Directory.Delete(_sourceDirectory, recursive: true);

        object Write(string folder, string id, string content, int schemaVersion)
        {
            var bytes = Encoding.UTF8.GetBytes(content);
            Directory.CreateDirectory(Path.Combine(_sourceDirectory, folder));
            File.WriteAllBytes(Path.Combine(_sourceDirectory, folder, $"{id}.yaml"), bytes);
            var version = content.Split('\n').First(line => line.StartsWith("version: ", StringComparison.Ordinal))["version: ".Length..];
            return new
            {
                id,
                version,
                schemaVersion,
                path = $"{folder}/{id}.yaml",
                sha256 = PluginStateStore.ComputeSha256(bytes),
                changelog = new[] { new { version, date = "2026-11-08", notes = $"Release {version}." } }
            };
        }

        var index = new
        {
            plugins = plugins.Select(plugin => Write("plugins", plugin.Id, plugin.Content, 2)).ToList(),
            bases = bases.Select(pluginBase => Write("bases", pluginBase.Id, pluginBase.Content, baseSchemaVersion)).ToList()
        };
        File.WriteAllText(Path.Combine(_sourceDirectory, "index.json"), JsonSerializer.Serialize(index));
    }

    private static object Entry(string id, string path, int schemaVersion) => new
    {
        id,
        version = "1.0.0",
        schemaVersion,
        path,
        sha256 = new string('0', 64)
    };

    private void InstallBase(string content)
    {
        Directory.CreateDirectory(_layout.BasesDirectory);
        File.WriteAllText(_layout.GetBasePath("shared"), content);
    }

    private void WritePlugin(PluginOrigin origin, string pluginId, string content)
    {
        Directory.CreateDirectory(_layout.GetDirectory(origin));
        File.WriteAllText(_layout.GetPluginPath(origin, pluginId), content);
    }

    private static string ChildYaml(string pluginId) => $"""
        pluginId: {pluginId}
        displayName: Tracker {pluginId}
        version: 1.0.0
        schemaVersion: 2
        extends: shared
        baseUrls:
          - https://tracker.test/

        """;

    private static string BaseYaml(string version = "1.0.0") => $$$"""
        baseId: shared
        displayName: Shared
        version: {{{version}}}
        schemaVersion: 2
        fields:
          - name: apiKey
            label: API Key
            type: password
            required: true
            sensitive: true
        http:
          headers:
            Accept: application/json
        steps:
          - name: user
            method: GET
            url: "api/user?api_token={{apiKey}}"
            responseType: html
            extract:
              ratio:
                regex: "<li\\s+class=\"ratio\">(?<value>[^\"]+)</li>"
        dashboard:
          metrics:
            - stat: ratio
              label: Ratio
              format: text

        """;

    public void Dispose()
    {
        if (Directory.Exists(_root))
            Directory.Delete(_root, recursive: true);
    }
}
