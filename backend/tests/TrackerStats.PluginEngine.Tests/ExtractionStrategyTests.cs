using System.Text.Json;
using Shouldly;
using TrackerStats.Domain.Plugins.Yaml;
using TrackerStats.PluginEngine.Extraction;

namespace TrackerStats.PluginEngine.Tests;

public class ExtractionStrategyTests
{
    [Fact]
    public void JsonPathExtraction_should_resolve_nested_properties_case_insensitively()
    {
        var strategy = new JsonPathExtractionStrategy();
        using var document = JsonDocument.Parse("""
            {
              "Metrics": {
                "Ratio": "1.75"
              }
            }
            """);
        var step = new StepDefinition
        {
            Name = "stats",
            Url = "https://tracker.test/stats",
            ResponseType = "json"
        };
        var rule = new ExtractionRule
        {
            Path = "metrics.ratio"
        };

        var value = strategy.Extract(step, "ratio", rule, document.RootElement.GetRawText(), document.RootElement);

        value.ShouldBe("1.75");
    }

    [Fact]
    public void JsonPathExtraction_should_throw_when_path_is_missing()
    {
        var strategy = new JsonPathExtractionStrategy();
        using var document = JsonDocument.Parse("""{"metrics":{}}""");
        var step = new StepDefinition
        {
            Name = "stats",
            Url = "https://tracker.test/stats",
            ResponseType = "json"
        };
        var rule = new ExtractionRule
        {
            Path = "metrics.ratio"
        };

        Should.Throw<InvalidOperationException>(() =>
            strategy.Extract(step, "ratio", rule, document.RootElement.GetRawText(), document.RootElement));
    }

    [Fact]
    public void JsonPathExtraction_should_return_boolean_and_null_values()
    {
        var strategy = new JsonPathExtractionStrategy();
        using var document = JsonDocument.Parse("""
            {
              "flags": {
                "enabled": true,
                "empty": null
              }
            }
            """);
        var step = new StepDefinition
        {
            Name = "stats",
            Url = "https://tracker.test/stats",
            ResponseType = "json"
        };

        strategy.Extract(step, "enabled", new ExtractionRule { Path = "flags.enabled" }, document.RootElement.GetRawText(), document.RootElement)
            .ShouldBe(bool.TrueString);
        strategy.Extract(step, "empty", new ExtractionRule { Path = "flags.empty" }, document.RootElement.GetRawText(), document.RootElement)
            .ShouldBe(string.Empty);
    }

    [Fact]
    public void RegexExtraction_should_prefer_named_group_matching_field_name()
    {
        var strategy = new RegexExtractionStrategy();
        var step = new StepDefinition
        {
            Name = "profile",
            Url = "https://tracker.test/profile"
        };
        var rule = new ExtractionRule
        {
            Regex = "Ratio:\\s*(?<ratio>[\\d\\.]+)\\s*\\((?<value>ignored)\\)"
        };

        var value = strategy.Extract(step, "ratio", rule, "Ratio: 2.50 (ignored)", jsonRoot: null);

        value.ShouldBe("2.50");
    }

    [Fact]
    public void RegexExtraction_should_fallback_to_first_captured_group()
    {
        var strategy = new RegexExtractionStrategy();
        var step = new StepDefinition
        {
            Name = "profile",
            Url = "https://tracker.test/profile"
        };
        var rule = new ExtractionRule
        {
            Regex = "Uploaded:\\s*([\\d\\.]+\\s*GiB)"
        };

        var value = strategy.Extract(step, "uploaded", rule, "Uploaded: 1.5 GiB", jsonRoot: null);

        value.ShouldBe("1.5 GiB");
    }

    [Fact]
    public void RegexExtraction_should_fallback_to_value_group_then_match_value()
    {
        var strategy = new RegexExtractionStrategy();
        var step = new StepDefinition
        {
            Name = "profile",
            Url = "https://tracker.test/profile"
        };

        strategy.Extract(step, "ratio", new ExtractionRule { Regex = "Ratio:\\s*(?<value>[\\d\\.]+)" }, "Ratio: 2.5", jsonRoot: null)
            .ShouldBe("2.5");

        strategy.Extract(step, "raw", new ExtractionRule { Regex = "NoGroups" }, "NoGroups", jsonRoot: null)
            .ShouldBe("NoGroups");
    }

    [Fact]
    public void CountMatchesExtraction_should_count_all_regex_matches()
    {
        var strategy = new CountMatchesExtractionStrategy();
        var step = new StepDefinition
        {
            Name = "seeding",
            Url = "https://tracker.test/seeding"
        };
        var rule = new ExtractionRule
        {
            CountMatches = true,
            Regex = "<tr class=\"torrent_row\">"
        };

        var value = strategy.Extract(step, "count", rule, """
            <tr class="torrent_row"></tr>
            <tr class="torrent_row"></tr>
            <tr class="torrent_row"></tr>
            """, jsonRoot: null);

        value.ShouldBe("3");
    }
}
