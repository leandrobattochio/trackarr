using Shouldly;
using TrackerStats.Domain.Plugins;
using TrackerStats.PluginEngine;

namespace TrackerStats.PluginEngine.Tests;

public class TemplateInterpolatorTests
{
    private readonly TemplateInterpolator _sut = new();

    [Fact]
    public void InterpolateTemplate_should_replace_fields_and_step_values_and_url_encode()
    {
        var configuration = new PluginConfiguration(new Dictionary<string, string?>
        {
            ["username"] = "alice@example.com",
            ["passkey"] = "abc 123"
        });
        var stepResults = new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase)
        {
            ["login"] = new(StringComparer.OrdinalIgnoreCase)
            {
                ["token"] = "token/value"
            }
        };

        var result = _sut.InterpolateTemplate(
            "https://tracker.test/api?user={{fields.username}}&key={{passkey}}&token={{steps.login.token}}",
            configuration,
            stepResults);

        result.ShouldBe("https://tracker.test/api?user=alice%40example.com&key=abc%20123&token=token%2Fvalue");
    }

    [Fact]
    public void InterpolateFieldValues_should_replace_known_fields_and_leave_missing_placeholders()
    {
        var configuration = new PluginConfiguration(new Dictionary<string, string?>
        {
            ["username"] = "alice"
        });

        var result = _sut.InterpolateFieldValues(
            "Welcome {{fields.username}} / {{missingField}}",
            configuration);

        result.ShouldBe("Welcome alice / {{missingField}}");
    }
}
