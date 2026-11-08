using Shouldly;
using TrackerStats.Domain.Plugins;
using TrackerStats.Domain.Plugins.Yaml;

namespace TrackerStats.Backend.Tests;

public class PluginSchemaTests
{
    [Fact]
    public void Supported_schema_version_should_be_one()
    {
        PluginSchema.SupportedPluginSchemaVersion.ShouldBe(1);
    }

    [Theory]
    [InlineData(null, 1, PluginSchemaCompatibility.Missing)]
    [InlineData(0, 1, PluginSchemaCompatibility.Invalid)]
    [InlineData(-1, 1, PluginSchemaCompatibility.Invalid)]
    [InlineData(1, 2, PluginSchemaCompatibility.Supported)]
    [InlineData(1, 1, PluginSchemaCompatibility.Supported)]
    [InlineData(2, 1, PluginSchemaCompatibility.Incompatible)]
    public void GetCompatibility_should_classify_schema_versions(int? schemaVersion, int supported, PluginSchemaCompatibility expected)
    {
        PluginSchema.GetCompatibility(schemaVersion, supported).ShouldBe(expected);
    }

    [Fact]
    public void GetCompatibility_should_default_to_the_supported_constant()
    {
        PluginSchema.GetCompatibility(PluginSchema.SupportedPluginSchemaVersion).ShouldBe(PluginSchemaCompatibility.Supported);
        PluginSchema.GetCompatibility(PluginSchema.SupportedPluginSchemaVersion + 1).ShouldBe(PluginSchemaCompatibility.Incompatible);
    }

    [Fact]
    public void GetVersionViolation_should_allow_missing_schema_version_when_not_required()
    {
        PluginSchema.GetVersionViolation(Definition(null, null), requireSchemaVersion: false, requireVersion: false).ShouldBeNull();
    }

    [Fact]
    public void GetVersionViolation_should_reject_missing_schema_version_when_required()
    {
        PluginSchema.GetVersionViolation(Definition(null, "1.0.0"), requireSchemaVersion: true, requireVersion: false)
            .ShouldBe("Plugin definition is missing required field 'schemaVersion'.");
    }

    [Fact]
    public void GetVersionViolation_should_reject_non_positive_schema_version()
    {
        PluginSchema.GetVersionViolation(Definition(0, null), requireSchemaVersion: false, requireVersion: false)
            .ShouldBe("Property 'schemaVersion' must be a positive integer.");
    }

    [Fact]
    public void GetVersionViolation_should_accept_equal_schema_version()
    {
        PluginSchema.GetVersionViolation(Definition(1, "1.0.0"), requireSchemaVersion: true, requireVersion: true).ShouldBeNull();
    }

    [Fact]
    public void GetVersionViolation_should_report_higher_schema_version_as_incompatible()
    {
        PluginSchema.GetVersionViolation(Definition(2, "1.0.0"), requireSchemaVersion: true, requireVersion: true)
            .ShouldBe("Plugin requires schema version 2, but this trackarr supports up to 1. Update trackarr to use it.");
    }

    [Fact]
    public void GetVersionViolation_should_reject_missing_version_when_required()
    {
        PluginSchema.GetVersionViolation(Definition(1, null), requireSchemaVersion: true, requireVersion: true)
            .ShouldBe("Plugin definition is missing required field 'version'.");
    }

    [Theory]
    [InlineData("1")]
    [InlineData("1.0")]
    [InlineData("v1.0.0")]
    [InlineData("01.0.0")]
    public void GetVersionViolation_should_reject_non_semantic_versions(string version)
    {
        PluginSchema.GetVersionViolation(Definition(1, version), requireSchemaVersion: false, requireVersion: false)
            .ShouldBe("Property 'version' must be a semantic version such as 1.2.0.");
    }

    [Theory]
    [InlineData("0.1.0")]
    [InlineData("1.2.3")]
    [InlineData("1.2.3-beta.1")]
    [InlineData("1.2.3+build.5")]
    public void IsSemanticVersion_should_accept_semver(string version)
    {
        PluginSchema.IsSemanticVersion(version).ShouldBeTrue();
    }

    [Theory]
    [InlineData("asc", true)]
    [InlineData("bj-share", true)]
    [InlineData("tracker2-v3", true)]
    [InlineData("", false)]
    [InlineData("Asc", false)]
    [InlineData("bj_share", false)]
    [InlineData("-asc", false)]
    [InlineData("asc-", false)]
    [InlineData("a--b", false)]
    [InlineData("../escaped", false)]
    [InlineData("asc\n", false)]
    public void IsValidPluginId_should_follow_the_plugin_id_rule(string pluginId, bool expected)
    {
        PluginSchema.IsValidPluginId(pluginId).ShouldBe(expected);
    }

    [Theory]
    [InlineData("1.0.0", "1.0.0", 0)]
    [InlineData("1.0.0", "1.0.1", -1)]
    [InlineData("1.2.0", "1.10.0", -1)]
    [InlineData("2.0.0", "1.99.99", 1)]
    [InlineData("1.0.0-alpha", "1.0.0", -1)]
    [InlineData("1.0.0-alpha", "1.0.0-alpha.1", -1)]
    [InlineData("1.0.0-alpha.1", "1.0.0-alpha.beta", -1)]
    [InlineData("1.0.0-beta.2", "1.0.0-beta.11", -1)]
    [InlineData("1.0.0-rc.1", "1.0.0-beta.11", 1)]
    [InlineData("1.0.0+build.1", "1.0.0+build.2", 0)]
    [InlineData("10000000000000000000.0.0", "9.0.0", 1)]
    public void CompareVersions_should_follow_semver_precedence(string left, string right, int expected)
    {
        PluginSchema.CompareVersions(left, right).ShouldBe(expected);
        PluginSchema.CompareVersions(right, left).ShouldBe(-expected);
    }

    [Fact]
    public void CompareVersions_should_reject_a_non_semantic_version()
    {
        Should.Throw<ArgumentException>(() => PluginSchema.CompareVersions("1.0", "1.0.0"));
    }

    private static PluginDefinition Definition(int? schemaVersion, string? version) => new()
    {
        PluginId = "plugin",
        DisplayName = "Plugin",
        SchemaVersion = schemaVersion,
        Version = version,
        Dashboard = new DashboardConfig()
    };
}
