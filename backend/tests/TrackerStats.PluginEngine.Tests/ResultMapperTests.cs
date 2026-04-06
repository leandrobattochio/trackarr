using Shouldly;
using TrackerStats.Domain.Plugins;
using TrackerStats.Domain.Plugins.Yaml;
using TrackerStats.PluginEngine;

namespace TrackerStats.PluginEngine.Tests;

public class ResultMapperTests
{
    private readonly ResultMapper _sut = new();

    [Fact]
    public void BuildResult_should_resolve_values_from_steps_fields_and_literals()
    {
        var definition = TestData.CreatePluginDefinition();
        var configuration = new PluginConfiguration(new Dictionary<string, string?>
        {
            ["requiredRatio"] = "1.25",
            ["bufferLabel"] = "VIP"
        });
        var stepResults = new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase)
        {
            ["stats"] = new(StringComparer.OrdinalIgnoreCase)
            {
                ["ratio"] = "2.50",
                ["uploaded"] = "1073741824",
                ["downloaded"] = "536870912",
                ["seeding"] = "7",
                ["leeching"] = "3",
                ["bonus"] = "VIP bonus",
                ["hnr"] = "0"
            }
        };

        var result = _sut.BuildResult(definition, configuration, stepResults);

        result.Result.ShouldBe(PluginProcessResult.Success);
        result.Stats.ShouldNotBeNull();
        result.Stats.Ratio.ShouldBe(2.50m);
        result.Stats.UploadedBytes.ShouldBe(1073741824L);
        result.Stats.DownloadedBytes.ShouldBe(536870912L);
        result.Stats.RequiredRatio.ShouldBe(1.25m);
        result.Stats.SeedingTorrents.ShouldBe(7);
        result.Stats.LeechingTorrents.ShouldBe(3);
        result.Stats.ActiveTorrents.ShouldBe(10);
        result.Stats.SeedBonus.ShouldBe("VIP bonus");
        result.Stats.Buffer.ShouldBe("VIP");
        result.Stats.HitAndRuns.ShouldBe(0);
    }

    [Fact]
    public void BuildResult_should_throw_when_mapping_is_missing()
    {
        var definition = TestData.CreatePluginDefinition();
        definition.Mapping = null;

        var exception = Should.Throw<InvalidOperationException>(() =>
            _sut.BuildResult(definition, new PluginConfiguration(new Dictionary<string, string?>()), []));

        exception.Message.ShouldContain("missing a mapping definition");
    }

    [Fact]
    public void BuildResult_should_throw_when_required_mapping_expression_is_missing()
    {
        var definition = TestData.CreatePluginDefinition();
        definition.Mapping!.Ratio = null;

        var exception = Should.Throw<InvalidOperationException>(() =>
            _sut.BuildResult(definition, new PluginConfiguration(new Dictionary<string, string?>()), []));

        exception.Message.ShouldContain("Mapping field 'Ratio' is required.");
    }

    [Fact]
    public void BuildResult_should_throw_when_step_operand_cannot_be_resolved()
    {
        var definition = TestData.CreatePluginDefinition();
        definition.Mapping!.Buffer = "steps.stats.missing";

        var exception = Should.Throw<InvalidOperationException>(() =>
            _sut.BuildResult(
                definition,
                new PluginConfiguration(new Dictionary<string, string?> { ["requiredRatio"] = "1.25" }),
                new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase)
                {
                    ["stats"] = new(StringComparer.OrdinalIgnoreCase)
                    {
                        ["ratio"] = "2.5",
                        ["uploaded"] = "10",
                        ["downloaded"] = "5",
                        ["seeding"] = "2",
                        ["leeching"] = "1"
                    }
                }));

        exception.Message.ShouldContain("Unable to resolve mapping operand");
    }

    [Fact]
    public void BuildResult_should_use_direct_configuration_values_and_literal_fallbacks()
    {
        var definition = TestData.CreatePluginDefinition();
        definition.Mapping!.Buffer = "bufferLabel";
        definition.Mapping.SeedBonus = "literal value";
        definition.Mapping.HitAndRuns = null;
        var configuration = new PluginConfiguration(new Dictionary<string, string?>
        {
            ["requiredRatio"] = "1.5",
            ["bufferLabel"] = "SAFE"
        });
        var stepResults = new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase)
        {
            ["stats"] = new(StringComparer.OrdinalIgnoreCase)
            {
                ["ratio"] = "3.0",
                ["uploaded"] = "100",
                ["downloaded"] = "50",
                ["seeding"] = "4",
                ["leeching"] = "1"
            }
        };

        var result = _sut.BuildResult(definition, configuration, stepResults);

        result.Stats.ShouldNotBeNull();
        result.Stats.Buffer.ShouldBe("SAFE");
        result.Stats.SeedBonus.ShouldBe("literal value");
        result.Stats.HitAndRuns.ShouldBeNull();
    }
}
