using Shouldly;
using TrackerStats.Domain.Plugins.Yaml;
using TrackerStats.Infrastructure.Plugins.Storage;
using TrackerStats.Infrastructure.Plugins.Yaml;

namespace TrackerStats.Backend.Tests;

public sealed class YamlPluginDefinitionLoaderTests : IDisposable
{
    private static readonly FakeApplicationSettingsService SettingsService = new();
    private readonly string _rootDirectory = Path.Combine(Path.GetTempPath(), $"trackerstats-loader-{Guid.NewGuid():N}");
    private readonly PluginStorageLayout _layout;

    public YamlPluginDefinitionLoaderTests()
    {
        Directory.CreateDirectory(_rootDirectory);
        _layout = PluginStorageLayout.ForDataDirectory(_rootDirectory);
    }

    [Fact]
    public void LoadDefinitions_should_return_empty_when_plugin_folders_do_not_exist()
    {
        CreateLoader().LoadDefinitions().ShouldBeEmpty();
    }

    [Theory]
    [InlineData(PluginOrigin.Official)]
    [InlineData(PluginOrigin.Override)]
    [InlineData(PluginOrigin.Custom)]
    public void LoadDefinitions_should_load_a_plugin_from_each_folder(PluginOrigin origin)
    {
        WritePlugin(origin, "solo.yaml", ValidPluginYaml("solo", header: ""));

        var definition = CreateLoader().LoadDefinitions().ShouldHaveSingleItem();

        definition.IsValid.ShouldBeTrue(definition.Error);
        definition.Origin.ShouldBe(origin);
        definition.FilePath.ShouldBe(Path.Combine(_layout.GetDirectory(origin), "solo.yaml"));
    }

    [Fact]
    public void LoadDefinitions_should_prefer_override_over_official()
    {
        WritePlugin(PluginOrigin.Official, "asc.yaml", ValidPluginYaml("asc", header: "", displayName: "Official"));
        WritePlugin(PluginOrigin.Override, "asc.yaml", ValidPluginYaml("asc", header: "", displayName: "Mine"));

        var definition = CreateLoader().LoadDefinitions().ShouldHaveSingleItem();

        definition.Origin.ShouldBe(PluginOrigin.Override);
        definition.DisplayName.ShouldBe("Mine");
    }

    [Fact]
    public void LoadDefinitions_should_keep_an_invalid_override_instead_of_falling_back_to_official()
    {
        WritePlugin(PluginOrigin.Official, "asc.yaml", ValidPluginYaml("asc", header: ""));
        WritePlugin(PluginOrigin.Override, "asc.yaml", "pluginId: asc\ndisplayName: [\n");

        var definition = CreateLoader().LoadDefinitions().ShouldHaveSingleItem();

        definition.Origin.ShouldBe(PluginOrigin.Override);
        definition.IsValid.ShouldBeFalse();
    }

    [Fact]
    public void LoadDefinitions_should_let_custom_win_over_official_with_the_same_id()
    {
        WritePlugin(PluginOrigin.Official, "shared.yaml", ValidPluginYaml("shared", header: "", displayName: "Official"));
        WritePlugin(PluginOrigin.Custom, "shared.yaml", ValidPluginYaml("shared", header: "", displayName: "Custom"));

        var loader = CreateLoader();
        var definition = loader.LoadDefinitions().ShouldHaveSingleItem();

        definition.Origin.ShouldBe(PluginOrigin.Custom);
        definition.DisplayName.ShouldBe("Custom");
        loader.LoadAllDefinitions().Select(entry => entry.Origin)
            .ShouldBe([PluginOrigin.Official, PluginOrigin.Custom], ignoreOrder: true);
    }

    [Fact]
    public void LoadDefinitions_should_prefer_override_over_custom()
    {
        WritePlugin(PluginOrigin.Override, "shared.yaml", ValidPluginYaml("shared", header: "", displayName: "Override"));
        WritePlugin(PluginOrigin.Custom, "shared.yaml", ValidPluginYaml("shared", header: "", displayName: "Custom"));
        WritePlugin(PluginOrigin.Official, "shared.yaml", ValidPluginYaml("shared", header: "", displayName: "Official"));

        var definition = CreateLoader().LoadDefinitions().ShouldHaveSingleItem();

        definition.Origin.ShouldBe(PluginOrigin.Override);
    }

    [Fact]
    public void LoadDefinitions_should_keep_an_orphan_override_without_official()
    {
        WritePlugin(PluginOrigin.Override, "gone.yaml", ValidPluginYaml("gone", header: ""));

        var definition = CreateLoader().LoadDefinitions().ShouldHaveSingleItem();

        definition.PluginId.ShouldBe("gone");
        definition.Origin.ShouldBe(PluginOrigin.Override);
        definition.IsValid.ShouldBeTrue(definition.Error);
    }

    [Fact]
    public void LoadDefinitions_should_return_one_entry_per_id_across_folders_sorted_by_id()
    {
        WritePlugin(PluginOrigin.Official, "zeta.yaml", ValidPluginYaml("zeta", header: ""));
        WritePlugin(PluginOrigin.Official, "alpha.yaml", ValidPluginYaml("alpha", header: ""));
        WritePlugin(PluginOrigin.Override, "alpha.yaml", ValidPluginYaml("alpha", header: ""));
        WritePlugin(PluginOrigin.Custom, "mid.yaml", ValidPluginYaml("mid", header: ""));

        var definitions = CreateLoader().LoadDefinitions();

        definitions.Select(definition => (definition.PluginId, definition.Origin)).ShouldBe([
            ("alpha", PluginOrigin.Override),
            ("mid", PluginOrigin.Custom),
            ("zeta", PluginOrigin.Official)
        ]);
    }

    [Fact]
    public void LoadDefinitions_should_ignore_override_base_copies()
    {
        WritePlugin(PluginOrigin.Override, "asc.yaml", ValidPluginYaml("asc", header: "", displayName: "Mine"));
        WritePlugin(PluginOrigin.Override, "asc.base.yaml", ValidPluginYaml("asc", header: "", displayName: "Base"));

        var all = CreateLoader().LoadAllDefinitions();

        var definition = all.ShouldHaveSingleItem();
        definition.DisplayName.ShouldBe("Mine");
        definition.IsValid.ShouldBeTrue(definition.Error);
    }

    [Fact]
    public void LoadDefinitions_should_read_from_disk_on_every_call()
    {
        var loader = CreateLoader();
        loader.LoadDefinitions().ShouldBeEmpty();

        WritePlugin(PluginOrigin.Custom, "fresh.yaml", ValidPluginYaml("fresh", header: "", displayName: "First"));
        loader.LoadDefinitions().ShouldHaveSingleItem().DisplayName.ShouldBe("First");

        WritePlugin(PluginOrigin.Custom, "fresh.yaml", ValidPluginYaml("fresh", header: "", displayName: "Second"));
        loader.LoadDefinitions().ShouldHaveSingleItem().DisplayName.ShouldBe("Second");
    }

    [Fact]
    public void LoadDefinitions_should_reject_file_whose_name_differs_from_its_plugin_id()
    {
        WritePlugin(PluginOrigin.Official, "broken-name.yaml", ValidPluginYaml("broken-id", header: "", displayName: "Broken Plugin"));

        var definition = CreateLoader().LoadDefinitions().ShouldHaveSingleItem();

        definition.PluginId.ShouldBe("broken-name");
        definition.DisplayName.ShouldBe("Broken Plugin");
        definition.IsValid.ShouldBeFalse();
        definition.Definition.ShouldBeNull();
        definition.Error.ShouldNotBeNull().ShouldContain("File name 'broken-name.yaml' does not match pluginId 'broken-id'.");
    }

    [Fact]
    public void LoadDefinitions_should_not_resolve_a_plugin_id_declared_only_by_a_misnamed_file()
    {
        WritePlugin(PluginOrigin.Custom, "custom-file.yaml", ValidPluginYaml("seedpool", header: ""));

        var definitions = CreateLoader().LoadDefinitions();

        definitions.ShouldNotContain(definition => definition.PluginId == "seedpool");
    }

    [Fact]
    public void LoadDefinitions_should_reject_both_files_when_two_files_declare_the_same_id_in_one_folder()
    {
        WritePlugin(PluginOrigin.Official, "asc.yaml", ValidPluginYaml("asc", header: ""));
        WritePlugin(PluginOrigin.Official, "asc-copy.yaml", ValidPluginYaml("asc", header: ""));

        var all = CreateLoader().LoadAllDefinitions();

        all.Count.ShouldBe(2);
        all.ShouldAllBe(definition => !definition.IsValid && definition.Definition == null);
        all.ShouldAllBe(definition => definition.Error!.Contains("Plugin id 'asc' is declared by more than one file in official/: asc-copy.yaml, asc.yaml."));
        CreateLoader().LoadDefinitions().Single(definition => definition.PluginId == "asc").IsValid.ShouldBeFalse();
    }

    [Fact]
    public void LoadDefinitions_should_reject_duplicate_ids_even_when_one_file_is_invalid_yaml()
    {
        WritePlugin(PluginOrigin.Custom, "dup.yaml", ValidPluginYaml("dup", header: ""));
        WritePlugin(PluginOrigin.Custom, "dup-two.yaml", "pluginId: dup\ndisplayName: [\n");

        var all = CreateLoader().LoadAllDefinitions();

        all.ShouldAllBe(definition => !definition.IsValid);
        all.ShouldAllBe(definition => definition.Error!.Contains("declared by more than one file in custom/"));
    }

    [Fact]
    public void LoadDefinitions_should_allow_the_same_id_in_different_folders()
    {
        WritePlugin(PluginOrigin.Official, "asc.yaml", ValidPluginYaml("asc", header: ""));
        WritePlugin(PluginOrigin.Override, "asc.yaml", ValidPluginYaml("asc", header: ""));

        CreateLoader().LoadAllDefinitions().ShouldAllBe(definition => definition.IsValid);
    }

    [Theory]
    [InlineData("Upper")]
    [InlineData("under_score")]
    [InlineData("double--hyphen")]
    [InlineData("dot.name")]
    public void LoadDefinitions_should_reject_file_names_failing_the_plugin_id_rule(string id)
    {
        WritePlugin(PluginOrigin.Custom, $"{id}.yaml", ValidPluginYaml(id, header: ""));

        var definition = CreateLoader().LoadDefinitions().ShouldHaveSingleItem();

        definition.PluginId.ShouldBe(id);
        definition.IsValid.ShouldBeFalse();
        definition.Error.ShouldNotBeNull().ShouldContain($"Plugin id '{id}' is invalid.");
    }

    [Fact]
    public void LoadDefinitions_should_reject_plugin_id_with_path_characters()
    {
        WritePlugin(PluginOrigin.Custom, "escaped.yaml", ValidPluginYaml("../escaped", header: ""));

        var definition = CreateLoader().LoadDefinitions().ShouldHaveSingleItem();

        definition.PluginId.ShouldBe("escaped");
        definition.IsValid.ShouldBeFalse();
        definition.Error.ShouldNotBeNull().ShouldContain("does not match pluginId '../escaped'");
    }

    [Fact]
    public void LoadDefinitions_should_report_misnamed_incompatible_plugin_as_invalid()
    {
        WritePlugin(PluginOrigin.Official, "other.yaml", ValidPluginYaml("future", header: "schemaVersion: 2"));

        var definition = CreateLoader().LoadDefinitions().ShouldHaveSingleItem();

        definition.Incompatible.ShouldBeFalse();
        definition.Error.ShouldNotBeNull().ShouldContain("does not match pluginId 'future'");
    }

    [Fact]
    public void LoadDefinitions_should_report_invalid_yaml_with_fallback_metadata()
    {
        WritePlugin(PluginOrigin.Custom, "broken.yaml", """
            pluginId: broken
            displayName: Broken Plugin
            baseUrls:
              - https://tracker.test/
            fields:
              - name: baseUrl
                label: Base URL
            """);

        var definition = CreateLoader().LoadDefinitions().ShouldHaveSingleItem();

        definition.PluginId.ShouldBe("broken");
        definition.DisplayName.ShouldBe("Broken Plugin");
        definition.IsValid.ShouldBeFalse();
        definition.Error.ShouldNotBeNull();
    }

    [Fact]
    public void LoadDefinitions_should_fall_back_to_filename_when_yaml_scalars_are_missing()
    {
        WritePlugin(PluginOrigin.Custom, "fallback.yaml", "pluginId:\ndisplayName:\nbaseUrls:\n  - https://tracker.test/\nfields: []\n");

        var definitions = CreateLoader().LoadDefinitions();

        definitions.Count.ShouldBe(1);
        definitions[0].PluginId.ShouldBe("fallback");
        definitions[0].DisplayName.ShouldBe("fallback");
        definitions[0].IsValid.ShouldBeFalse();
    }

    [Fact]
    public void LoadDefinitions_should_load_plugin_without_schema_version()
    {
        var loader = CreateLoaderWith("legacy.yaml", ValidPluginYaml("legacy", header: ""));

        var definition = loader.LoadDefinitions().ShouldHaveSingleItem();

        definition.IsValid.ShouldBeTrue();
        definition.Incompatible.ShouldBeFalse();
        definition.Definition!.SchemaVersion.ShouldBeNull();
        definition.Definition.Version.ShouldBeNull();
    }

    [Fact]
    public void LoadDefinitions_should_load_version_schema_version_and_changelog()
    {
        var loader = CreateLoaderWith("current.yaml", ValidPluginYaml("current", header: """
            version: 1.2.0
            schemaVersion: 1
            changelog:
              - version: 1.2.0
                date: "2026-11-07"
                notes: Fixed the ratio selector.
            """));

        var definition = loader.LoadDefinitions().ShouldHaveSingleItem();

        definition.IsValid.ShouldBeTrue(definition.Error);
        definition.Incompatible.ShouldBeFalse();
        definition.Definition!.Version.ShouldBe("1.2.0");
        definition.Definition.SchemaVersion.ShouldBe(1);
        var entry = definition.Definition.Changelog.ShouldNotBeNull().ShouldHaveSingleItem();
        entry.Version.ShouldBe("1.2.0");
        entry.Date.ShouldBe("2026-11-07");
        entry.Notes.ShouldBe("Fixed the ratio selector.");
    }

    [Fact]
    public void LoadDefinitions_should_reject_schema_version_below_one()
    {
        var loader = CreateLoaderWith("zero.yaml", ValidPluginYaml("zero", header: "schemaVersion: 0"));

        var definition = loader.LoadDefinitions().ShouldHaveSingleItem();

        definition.IsValid.ShouldBeFalse();
        definition.Incompatible.ShouldBeFalse();
        definition.Error.ShouldNotBeNull().ShouldContain("Property 'schemaVersion' must be a positive integer.");
    }

    [Fact]
    public void LoadDefinitions_should_report_higher_schema_version_as_incompatible()
    {
        var loader = CreateLoaderWith("future.yaml", ValidPluginYaml("future", header: """
            version: 2.0.0
            schemaVersion: 2
            someFutureKey:
              enabled: true
            """));

        var definition = loader.LoadDefinitions().ShouldHaveSingleItem();

        definition.PluginId.ShouldBe("future");
        definition.DisplayName.ShouldBe("Plugin future");
        definition.IsValid.ShouldBeFalse();
        definition.Incompatible.ShouldBeTrue();
        definition.Definition.ShouldBeNull();
        definition.Error.ShouldNotBeNull().ShouldContain("Plugin requires schema version 2, but this trackarr supports up to 1.");
    }

    [Fact]
    public void LoadDefinitions_should_reject_non_semantic_version()
    {
        var loader = CreateLoaderWith("bad-version.yaml", ValidPluginYaml("bad-version", header: "version: v1"));

        var definition = loader.LoadDefinitions().ShouldHaveSingleItem();

        definition.IsValid.ShouldBeFalse();
        definition.Error.ShouldNotBeNull().ShouldContain("Property 'version' must be a semantic version such as 1.2.0.");
    }

    private YamlPluginDefinitionLoader CreateLoaderWith(string fileName, string content)
    {
        WritePlugin(PluginOrigin.Custom, fileName, content);
        return CreateLoader();
    }

    private YamlPluginDefinitionLoader CreateLoader() => new(_layout, SettingsService);

    private void WritePlugin(PluginOrigin origin, string fileName, string content)
    {
        var directory = _layout.GetDirectory(origin);
        Directory.CreateDirectory(directory);
        File.WriteAllText(Path.Combine(directory, fileName), content);
    }

    private static string ValidPluginYaml(string pluginId, string header, string? displayName = null) => $"""
        pluginId: {pluginId}
        displayName: {displayName ?? $"Plugin {pluginId}"}
        {header}
        baseUrls:
          - https://tracker.test/
        fields: []
        steps:
          - name: profile
            method: GET
            url: /
            responseType: html
        dashboard:
          metrics:
            - stat: ratio
              label: Ratio
        """;

    public void Dispose()
    {
        if (Directory.Exists(_rootDirectory))
            Directory.Delete(_rootDirectory, recursive: true);
    }
}
