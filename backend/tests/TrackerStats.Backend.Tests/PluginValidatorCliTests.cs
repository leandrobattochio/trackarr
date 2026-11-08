using Shouldly;
using TrackerStats.PluginValidator;

namespace TrackerStats.Backend.Tests;

public sealed class PluginValidatorCliTests : IDisposable
{
    private static readonly string ValidYaml = """
        # Comments are allowed.
        pluginId: test-plugin
        displayName: Test Plugin
        version: 1.0.0
        schemaVersion: 1
        changelog:
          - version: 1.0.0
            date: "2026-11-07"
            notes: Initial release.
        baseUrls:
          - https://tracker.test/
        fields:
          - name: cookie
            label: Cookie
            type: text
            required: true
            sensitive: true
        steps:
          - name: profile
            method: GET
            url: "/"
            responseType: html
        dashboard:
          metrics:
            - stat: ratio
              label: Ratio
              format: text
        """.ReplaceLineEndings("\n");

    private readonly string _directory = Path.Combine(Path.GetTempPath(), $"plugin-validator-{Guid.NewGuid():N}");

    public PluginValidatorCliTests() => Directory.CreateDirectory(_directory);

    public void Dispose() => Directory.Delete(_directory, recursive: true);

    [Fact]
    public void Run_should_exit_zero_for_a_valid_file()
    {
        var path = Write("test-plugin", ValidYaml);

        var (exitCode, output, error) = Run(path);

        exitCode.ShouldBe(PluginValidatorCli.Success);
        output.ShouldContain($"OK      {path}");
        output.ShouldContain("1 valid, 0 invalid.");
        error.ShouldBeEmpty();
    }

    [Fact]
    public void Run_should_accept_the_fixture_official_plugins()
    {
        var paths = Directory.GetFiles(Path.Combine(AppContext.BaseDirectory, "plugin-source", "plugins"), "*.yaml");
        paths.ShouldNotBeEmpty();

        var (exitCode, _, error) = Run(paths);

        error.ShouldBeEmpty();
        exitCode.ShouldBe(PluginValidatorCli.Success);
    }

    [Fact]
    public void Run_should_print_usage_without_paths()
    {
        var (exitCode, _, error) = Run();

        exitCode.ShouldBe(PluginValidatorCli.UsageError);
        error.ShouldStartWith("Usage:");
    }

    [Fact]
    public void Run_should_report_one_error_per_invalid_file_and_keep_validating()
    {
        var valid = Write("test-plugin", ValidYaml);
        var badId = Write("bad-id", ValidYaml.Replace("pluginId: test-plugin", "pluginId: Bad_Id"));
        var badSchema = Write("test-plugin-2", ValidYaml.Replace("pluginId: test-plugin", "pluginId: test-plugin-2").Replace("schemaVersion: 1", "schemaVersion: 0"));

        var (exitCode, output, error) = Run(badId, valid, badSchema);

        exitCode.ShouldBe(PluginValidatorCli.InvalidFiles);
        output.ShouldContain($"OK      {valid}");
        output.ShouldContain("1 valid, 2 invalid.");
        var errorLines = error.Split(Environment.NewLine, StringSplitOptions.RemoveEmptyEntries);
        errorLines.Length.ShouldBe(2);
        errorLines[0].ShouldStartWith($"INVALID {badId}: Plugin id 'Bad_Id' is invalid.");
        errorLines[1].ShouldBe($"INVALID {badSchema}: Property 'schemaVersion' must be a positive integer.");
    }

    public static TheoryData<string, string, string> InvalidFiles => new()
    {
        // YAML syntax
        { "test-plugin", "pluginId: [unclosed", "Invalid YAML syntax:" },
        // Schema: unknown property, missing required field, bad value
        { "test-plugin", ValidYaml + "\nunknownKey: true", "Invalid YAML syntax: Property 'unknownKey' not found" },
        { "test-plugin", ValidYaml.Replace("displayName: Test Plugin\n", ""), "Plugin definition is missing required field 'displayName'." },
        { "test-plugin", ValidYaml.Replace("- stat: ratio", "- stat: karma"), "Dashboard metrics contain an unsupported 'stat' value." },
        // pluginId rule
        { "escaped", ValidYaml.Replace("pluginId: test-plugin", "pluginId: ../escaped"), "Plugin id '../escaped' is invalid. It must match ^[a-z0-9]+(-[a-z0-9]+)*$" },
        { "test--plugin", ValidYaml.Replace("pluginId: test-plugin", "pluginId: test--plugin"), "Plugin id 'test--plugin' is invalid." },
        { "test-plugin", ValidYaml.Replace("pluginId: test-plugin", "pluginId: \"\""), "Plugin definition is missing required field 'pluginId'." },
        // File name must equal pluginId
        { "other-name", ValidYaml, "File name 'other-name' must equal pluginId 'test-plugin'." },
        // Reserved fields
        { "test-plugin", ValidYaml.Replace("- name: cookie", "- name: cron"), "Fields [cron] are engine-owned and must not be declared in plugin YAML." },
        { "test-plugin", ValidYaml + "\nhttp:\n  baseUrl: https://tracker.test/", "Property 'http.baseUrl' is engine-owned and must not be declared in plugin YAML." },
        // schemaVersion
        { "test-plugin", ValidYaml.Replace("schemaVersion: 1\n", ""), "Plugin definition is missing required field 'schemaVersion'." },
        { "test-plugin", ValidYaml.Replace("schemaVersion: 1", "schemaVersion: 0"), "Property 'schemaVersion' must be a positive integer." },
        { "test-plugin", ValidYaml.Replace("schemaVersion: 1", "schemaVersion: 99"), "Plugin requires schema version 99, but this trackarr supports up to 1." },
        // version
        { "test-plugin", ValidYaml.Replace("version: 1.0.0\nschemaVersion", "schemaVersion"), "Plugin definition is missing required field 'version'." },
        { "test-plugin", ValidYaml.Replace("version: 1.0.0\nschemaVersion", "version: v1\nschemaVersion"), "Property 'version' must be a semantic version such as 1.2.0." },
        // Empty file
        { "test-plugin", "  \n", "File is empty." }
    };

    [Theory]
    [MemberData(nameof(InvalidFiles))]
    public void Run_should_reject_each_class_of_error(string fileName, string yaml, string expectedError)
    {
        var path = Write(fileName, yaml);

        var (exitCode, output, error) = Run(path);

        exitCode.ShouldBe(PluginValidatorCli.InvalidFiles);
        output.ShouldContain("0 valid, 1 invalid.");
        error.ShouldStartWith($"INVALID {path}: {expectedError}");
    }

    [Fact]
    public void Run_should_reject_a_missing_file()
    {
        var path = Path.Combine(_directory, "missing.yaml");

        var (exitCode, _, error) = Run(path);

        exitCode.ShouldBe(PluginValidatorCli.InvalidFiles);
        error.ShouldStartWith($"INVALID {path}: Cannot read file:");
    }

    private string Write(string fileName, string content)
    {
        var path = Path.Combine(_directory, $"{fileName}.yaml");
        File.WriteAllText(path, content);
        return path;
    }

    private static (int ExitCode, string Output, string Error) Run(params string[] paths)
    {
        using var output = new StringWriter();
        using var error = new StringWriter();
        var exitCode = PluginValidatorCli.Run(paths, output, error);
        return (exitCode, output.ToString(), error.ToString());
    }
}
