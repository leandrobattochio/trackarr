using Shouldly;
using TrackerStats.PluginEngine.Transforms;

namespace TrackerStats.PluginEngine.Tests;

public class TransformStrategyTests
{
    [Fact]
    public void DecimalTransform_should_normalize_comma_decimal_values()
    {
        var strategy = new DecimalTransformStrategy();

        var result = strategy.Transform("1.234,56");

        result.ShouldBe("1234.56");
    }

    [Fact]
    public void IntegerTransform_should_strip_grouping_separators()
    {
        var strategy = new IntegerTransformStrategy();

        var result = strategy.Transform("1.234");

        result.ShouldBe("1234");
    }

    [Fact]
    public void ByteSizeTransform_should_convert_binary_units_to_bytes()
    {
        var strategy = new ByteSizeTransformStrategy();

        var result = strategy.Transform("1.5 GiB");

        result.ShouldBe("1610612736");
    }

    [Theory]
    [InlineData("1 KB", "1000")]
    [InlineData("1 KiB", "1024")]
    [InlineData("2 MB", "2000000")]
    [InlineData("2 MiB", "2097152")]
    [InlineData("1 TB", "1000000000000")]
    [InlineData("1 TiB", "1099511627776")]
    public void ByteSizeTransform_should_support_multiple_units(string input, string expected)
    {
        var strategy = new ByteSizeTransformStrategy();

        var result = strategy.Transform(input);

        result.ShouldBe(expected);
    }

    [Fact]
    public void ByteSizeTransform_should_throw_for_invalid_unit()
    {
        var strategy = new ByteSizeTransformStrategy();

        Should.Throw<InvalidOperationException>(() => strategy.Transform("1 XB"));
    }

    [Fact]
    public void ToStringTransform_should_trim_surrounding_whitespace()
    {
        var strategy = new ToStringTransformStrategy();

        var result = strategy.Transform("  seeded  ");

        result.ShouldBe("seeded");
    }
}
