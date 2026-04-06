using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Shouldly;
using TrackerStats.Api.Controllers;
using TrackerStats.Infrastructure.Plugins.Yaml;

namespace TrackerStats.Backend.Tests;

public class PluginsControllerTests
{
    [Fact]
    public async Task Create_should_reject_empty_yaml_body()
    {
        using var fixture = new PluginsFixture();
        var controller = fixture.CreateController();
        TestHttp.SetYamlBody(controller, "");

        var result = await controller.Create(CancellationToken.None);

        var badRequest = result.ShouldBeOfType<BadRequestObjectResult>();
        TestHttp.ToJson(badRequest.Value).GetProperty("error").GetString().ShouldBe("Request body must contain YAML.");
    }

    [Fact]
    public async Task Create_should_write_plugin_yaml_to_disk()
    {
        using var fixture = new PluginsFixture();
        var controller = fixture.CreateController();
        var yaml = """
            pluginId: test-plugin
            displayName: Test Plugin
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
            """;
        TestHttp.SetYamlBody(controller, yaml);

        var result = await controller.Create(CancellationToken.None);

        var created = result.ShouldBeOfType<CreatedAtActionResult>();
        created.RouteValues!["pluginId"].ShouldBe("test-plugin");
        File.Exists(Path.Combine(fixture.PluginsDirectory, "test-plugin.yaml")).ShouldBeTrue();
    }

    [Fact]
    public async Task Create_should_return_conflict_when_plugin_already_exists()
    {
        using var fixture = new PluginsFixture();
        File.WriteAllText(Path.Combine(fixture.PluginsDirectory, "test-plugin.yaml"), "pluginId: test-plugin");
        var controller = fixture.CreateController();
        TestHttp.SetYamlBody(controller, """
            pluginId: test-plugin
            displayName: Test Plugin
            fields: []
            steps:
              - name: profile
                method: GET
                url: "/"
                responseType: html
            dashboard:
              metrics:
                - stat: ratio
                  label: Ratio
            """);

        var result = await controller.Create(CancellationToken.None);

        var conflict = result.ShouldBeOfType<ConflictObjectResult>();
        TestHttp.ToJson(conflict.Value).GetProperty("error").GetString().ShouldBe("Plugin 'test-plugin' already exists.");
    }

    [Fact]
    public async Task Create_should_reject_invalid_dashboard_metric_values()
    {
        using var fixture = new PluginsFixture();
        var controller = fixture.CreateController();
        TestHttp.SetYamlBody(controller, """
            pluginId: invalid-plugin
            displayName: Invalid Plugin
            fields: []
            steps:
              - name: profile
                method: GET
                url: "/"
                responseType: html
            dashboard:
              metrics:
                - stat: notAStat
                  label: Ratio
            """);

        var result = await controller.Create(CancellationToken.None);

        var badRequest = result.ShouldBeOfType<BadRequestObjectResult>();
        TestHttp.ToJson(badRequest.Value).GetProperty("error").GetString().ShouldBe("Dashboard metrics contain an unsupported 'stat' value.");
    }

    [Fact]
    public async Task Create_should_reject_invalid_yaml_syntax()
    {
        using var fixture = new PluginsFixture();
        var controller = fixture.CreateController();
        TestHttp.SetYamlBody(controller, "pluginId: [");

        var result = await controller.Create(CancellationToken.None);

        var badRequest = result.ShouldBeOfType<BadRequestObjectResult>();
        var error = TestHttp.ToJson(badRequest.Value).GetProperty("error").GetString();
        error.ShouldNotBeNull();
        error.ShouldContain("Invalid YAML syntax:");
    }

    [Fact]
    public async Task Create_should_reject_missing_display_name()
    {
        using var fixture = new PluginsFixture();
        var controller = fixture.CreateController();
        TestHttp.SetYamlBody(controller, """
            pluginId: invalid-plugin
            fields: []
            steps:
              - name: profile
                method: GET
                url: "/"
                responseType: html
            dashboard:
              metrics:
                - stat: ratio
                  label: Ratio
            """);

        var result = await controller.Create(CancellationToken.None);

        var badRequest = result.ShouldBeOfType<BadRequestObjectResult>();
        TestHttp.ToJson(badRequest.Value).GetProperty("error").GetString().ShouldBe("Plugin definition is missing required field 'displayName'.");
    }

    [Fact]
    public async Task Create_should_reject_unsupported_byte_unit_system()
    {
        using var fixture = new PluginsFixture();
        var controller = fixture.CreateController();
        TestHttp.SetYamlBody(controller, """
            pluginId: invalid-plugin
            displayName: Invalid
            fields: []
            steps:
              - name: profile
                method: GET
                url: "/"
                responseType: html
            dashboard:
              byteUnitSystem: invalid
              metrics:
                - stat: uploadedBytes
                  label: Uploaded
                  format: bytes
            """);

        var result = await controller.Create(CancellationToken.None);

        var badRequest = result.ShouldBeOfType<BadRequestObjectResult>();
        TestHttp.ToJson(badRequest.Value).GetProperty("error").GetString().ShouldBe("Dashboard config contains an unsupported 'byteUnitSystem' value.");
    }

    [Fact]
    public void GetByPluginId_should_return_not_found_when_plugin_does_not_exist()
    {
        using var fixture = new PluginsFixture();
        var controller = fixture.CreateController();

        var result = controller.GetByPluginId("missing");

        result.ShouldBeOfType<NotFoundResult>();
    }

    [Fact]
    public void GetByPluginId_should_return_editable_yaml_without_engine_owned_defaults()
    {
        using var fixture = new PluginsFixture();
        File.WriteAllText(Path.Combine(fixture.PluginsDirectory, "seedpool.yaml"), """
            pluginId: seedpool
            displayName: Seedpool
            fields:
              - name: apiKey
                label: API Key
                type: password
                required: true
                sensitive: true
            steps:
              - name: user
                method: GET
                url: "api/user?api_token={{apiKey}}"
                responseType: json
            dashboard:
              metrics:
                - stat: ratio
                  label: Ratio
            """);
        var controller = fixture.CreateController();

        var result = controller.GetByPluginId("seedpool");

        var content = result.ShouldBeOfType<ContentResult>();
        content.ContentType.ShouldBe("application/yaml");
        content.Content.ShouldNotBeNull();
        content.Content.ShouldContain("pluginId: seedpool");
        content.Content.ShouldNotContain("baseUrl");
        content.Content.ShouldNotContain("required_ratio");
        content.Content.ShouldNotContain("User-Agent");
    }

    [Fact]
    public void GetByPluginId_should_return_raw_yaml_for_invalid_definitions()
    {
        using var fixture = new PluginsFixture();
        var rawYaml = """
            pluginId: broken
            displayName: Broken
            fields:
              - name: baseUrl
                label: Base URL
            """;
        File.WriteAllText(Path.Combine(fixture.PluginsDirectory, "broken.yaml"), rawYaml);
        var controller = fixture.CreateController();

        var result = controller.GetByPluginId("broken");

        var content = result.ShouldBeOfType<ContentResult>();
        content.ContentType.ShouldBe("application/yaml");
        content.Content.ShouldBe(rawYaml);
    }

    [Fact]
    public void GetAll_should_return_validation_status_for_loaded_plugins()
    {
        using var fixture = new PluginsFixture();
        File.WriteAllText(Path.Combine(fixture.PluginsDirectory, "valid.yaml"), """
            pluginId: valid
            displayName: Valid
            fields: []
            steps:
              - name: profile
                method: GET
                url: "/"
                responseType: html
            dashboard:
              metrics:
                - stat: ratio
                  label: Ratio
            """);
        File.WriteAllText(Path.Combine(fixture.PluginsDirectory, "invalid.yaml"), """
            pluginId: invalid
            displayName: Invalid
            fields:
              - name: baseUrl
                label: Base URL
            steps:
              - name: profile
                method: GET
                url: "/"
                responseType: html
            dashboard:
              metrics:
                - stat: ratio
                  label: Ratio
            """);
        var controller = fixture.CreateController();

        var result = controller.GetAll();

        var ok = result.ShouldBeOfType<OkObjectResult>();
        var json = TestHttp.ToJson(ok.Value);
        json.GetArrayLength().ShouldBe(2);
        json.EnumerateArray().ShouldContain(item => item.GetProperty("pluginId").GetString() == "valid" && item.GetProperty("definitionValid").GetBoolean());
        json.EnumerateArray().ShouldContain(item => item.GetProperty("pluginId").GetString() == "invalid" && !item.GetProperty("definitionValid").GetBoolean());
    }

    [Fact]
    public void GetAll_should_include_custom_fields_for_valid_plugins()
    {
        using var fixture = new PluginsFixture();
        File.WriteAllText(Path.Combine(fixture.PluginsDirectory, "valid.yaml"), """
            pluginId: valid
            displayName: Valid
            fields: []
            customFields:
              - name: token
                label: Token
                type: text
                required: false
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
            """);
        var controller = fixture.CreateController();

        var result = controller.GetAll();

        var ok = result.ShouldBeOfType<OkObjectResult>();
        var json = TestHttp.ToJson(ok.Value);
        json[0].GetProperty("customFields").GetArrayLength().ShouldBe(1);
        json[0].GetProperty("customFields")[0].GetProperty("name").GetString().ShouldBe("token");
    }

    [Theory]
    [InlineData("""
        displayName: Invalid
        fields: []
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
        """, "Plugin definition is missing required field 'pluginId'.")]
    [InlineData("""
        pluginId: invalid
        displayName: Invalid
        fields: []
        steps: []
        dashboard:
          metrics:
            - stat: ratio
              label: Ratio
              format: text
        """, "Plugin definition is missing required field 'steps'.")]
    [InlineData("null", "YAML could not be deserialized into a plugin definition.")]
    [InlineData("""
        pluginId: invalid
        displayName: Invalid
        fields:
          - name: ""
            label: Label
            type: text
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
        """, "Each field must define 'name'.")]
    [InlineData("""
        pluginId: invalid
        displayName: Invalid
        fields:
          - name: token
            label: ""
            type: text
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
        """, "Each field must define 'label'.")]
    [InlineData("""
        pluginId: invalid
        displayName: Invalid
        fields:
          - name: token
            label: Token
            type: ""
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
        """, "Each field must define 'type'.")]
    [InlineData("""
        pluginId: invalid
        displayName: Invalid
        fields: []
        steps:
          - name: ""
            method: GET
            url: "/"
            responseType: html
        dashboard:
          metrics:
            - stat: ratio
              label: Ratio
              format: text
        """, "Each step must define 'name'.")]
    [InlineData("""
        pluginId: invalid
        displayName: Invalid
        fields: []
        steps:
          - name: profile
            method: ""
            url: "/"
            responseType: html
        dashboard:
          metrics:
            - stat: ratio
              label: Ratio
              format: text
        """, "Each step must define 'method'.")]
    [InlineData("""
        pluginId: invalid
        displayName: Invalid
        fields: []
        steps:
          - name: profile
            method: GET
            url: ""
            responseType: html
        dashboard:
          metrics:
            - stat: ratio
              label: Ratio
              format: text
        """, "Each step must define 'url'.")]
    [InlineData("""
        pluginId: invalid
        displayName: Invalid
        fields: []
        steps:
          - name: profile
            method: GET
            url: "/"
            responseType: ""
        dashboard:
          metrics:
            - stat: ratio
              label: Ratio
              format: text
        """, "Each step must define 'responseType'.")]
    [InlineData("""
        pluginId: invalid
        displayName: Invalid
        fields: []
        steps:
          - name: profile
            method: GET
            url: "/"
            responseType: html
        dashboard:
          metrics:
            - stat: ""
              label: Ratio
              format: text
        """, "Each dashboard metric must define 'stat'.")]
    [InlineData("""
        pluginId: invalid
        displayName: Invalid
        fields: []
        steps:
          - name: profile
            method: GET
            url: "/"
            responseType: html
        dashboard:
          metrics:
            - stat: ratio
              label: ""
              format: text
        """, "Each dashboard metric must define 'label'.")]
    [InlineData("""
        pluginId: invalid
        displayName: Invalid
        fields: []
        steps:
          - name: profile
            method: GET
            url: "/"
            responseType: html
        dashboard:
          metrics:
            - stat: ratio
              label: Ratio
              format: ""
        """, "Each dashboard metric must define 'format'.")]
    [InlineData("""
        pluginId: invalid
        displayName: Invalid
        fields: []
        steps:
          - name: profile
            method: GET
            url: "/"
            responseType: html
        dashboard:
          metrics:
            - stat: ratio
              label: Ratio
              format: nope
        """, "Dashboard metrics contain an unsupported 'format' value.")]
    public async Task Create_should_reject_additional_validation_errors(string yaml, string expectedError)
    {
        using var fixture = new PluginsFixture();
        var controller = fixture.CreateController();
        TestHttp.SetYamlBody(controller, yaml);

        var result = await controller.Create(CancellationToken.None);

        var badRequest = result.ShouldBeOfType<BadRequestObjectResult>();
        TestHttp.ToJson(badRequest.Value).GetProperty("error").GetString().ShouldBe(expectedError);
    }

    [Fact]
    public async Task Update_should_reject_route_and_yaml_plugin_id_mismatch()
    {
        using var fixture = new PluginsFixture();
        File.WriteAllText(Path.Combine(fixture.PluginsDirectory, "seedpool.yaml"), "pluginId: seedpool");
        var controller = fixture.CreateController();
        TestHttp.SetYamlBody(controller, """
            pluginId: other-plugin
            displayName: Other Plugin
            fields: []
            steps:
              - name: profile
                method: GET
                url: "/"
                responseType: html
            dashboard:
              metrics:
                - stat: ratio
                  label: Ratio
            """);

        var result = await controller.Update("seedpool", CancellationToken.None);

        var badRequest = result.ShouldBeOfType<BadRequestObjectResult>();
        TestHttp.ToJson(badRequest.Value).GetProperty("error").GetString().ShouldBe("Plugin ID in YAML must match the route parameter.");
    }

    [Fact]
    public async Task Update_should_reject_invalid_yaml_syntax()
    {
        using var fixture = new PluginsFixture();
        File.WriteAllText(Path.Combine(fixture.PluginsDirectory, "seedpool.yaml"), "pluginId: seedpool");
        var controller = fixture.CreateController();
        TestHttp.SetYamlBody(controller, "pluginId: [");

        var result = await controller.Update("seedpool", CancellationToken.None);

        var badRequest = result.ShouldBeOfType<BadRequestObjectResult>();
        var error = TestHttp.ToJson(badRequest.Value).GetProperty("error").GetString();
        error.ShouldNotBeNull();
        error.ShouldContain("Invalid YAML syntax:");
    }

    [Fact]
    public async Task Update_should_return_not_found_when_plugin_file_cannot_be_found()
    {
        using var fixture = new PluginsFixture();
        var controller = fixture.CreateController();
        TestHttp.SetYamlBody(controller, """
            pluginId: seedpool
            displayName: Seedpool
            fields: []
            steps:
              - name: profile
                method: GET
                url: "/"
                responseType: html
            dashboard:
              metrics:
                - stat: ratio
                  label: Ratio
            """);

        var result = await controller.Update("seedpool", CancellationToken.None);

        result.ShouldBeOfType<NotFoundResult>();
    }

    [Fact]
    public async Task Update_should_write_yaml_when_matching_plugin_exists_under_different_filename()
    {
        using var fixture = new PluginsFixture();
        var existingPath = Path.Combine(fixture.PluginsDirectory, "custom-file.yaml");
        File.WriteAllText(existingPath, """
            pluginId: seedpool
            displayName: Seedpool
            fields: []
            steps:
              - name: profile
                method: GET
                url: "/"
                responseType: html
            dashboard:
              metrics:
                - stat: ratio
                  label: Ratio
            """);
        var controller = fixture.CreateController();
        var updatedYaml = """
            pluginId: seedpool
            displayName: Updated Seedpool
            fields: []
            steps:
              - name: profile
                method: GET
                url: "/profile"
                responseType: html
            dashboard:
              metrics:
                - stat: ratio
                  label: Ratio
            """;
        TestHttp.SetYamlBody(controller, updatedYaml);

        var result = await controller.Update("seedpool", CancellationToken.None);

        result.ShouldBeOfType<OkObjectResult>();
        File.ReadAllText(existingPath).ShouldBe(updatedYaml);
    }

    [Fact]
    public async Task Create_should_throw_when_plugins_directory_is_not_configured()
    {
        using var fixture = new PluginsFixture(usePluginsDirectory: false);
        var controller = fixture.CreateController();
        var yaml = """
            pluginId: base-plugin
            displayName: Base Plugin
            fields: []
            steps:
              - name: profile
                method: GET
                url: "/"
                responseType: html
            dashboard:
              metrics:
                - stat: ratio
                  label: Ratio
            """;
        TestHttp.SetYamlBody(controller, yaml);

        var ex = await Should.ThrowAsync<InvalidOperationException>(() => controller.Create(CancellationToken.None));

        ex.Message.ShouldBe("Plugins directory is not configured. Set 'Plugins:Directory'.");
    }

    [Fact]
    public async Task Create_should_allow_missing_plugin_directory_and_create_it()
    {
        using var fixture = new PluginsFixture();
        Directory.Delete(fixture.PluginsDirectory, recursive: true);
        var controller = fixture.CreateController();
        TestHttp.SetYamlBody(controller, """
            pluginId: created-dir
            displayName: Created Dir
            fields: []
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
            """);

        var result = await controller.Create(CancellationToken.None);

        result.ShouldBeOfType<CreatedAtActionResult>();
        Directory.Exists(fixture.PluginsDirectory).ShouldBeTrue();
    }

    [Fact]
    public async Task Create_should_reject_reserved_engine_owned_properties()
    {
        using var fixture = new PluginsFixture();
        var controller = fixture.CreateController();
        TestHttp.SetYamlBody(controller, """
            pluginId: invalid
            displayName: Invalid
            fields:
              - name: baseUrl
                label: Base URL
                type: text
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
            """);

        var result = await controller.Create(CancellationToken.None);

        var badRequest = result.ShouldBeOfType<BadRequestObjectResult>();
        var error = TestHttp.ToJson(badRequest.Value).GetProperty("error").GetString();
        error.ShouldNotBeNull();
        error.ShouldContain("engine-owned");
    }

    [Fact]
    public async Task Create_should_reject_missing_dashboard_metrics()
    {
        using var fixture = new PluginsFixture();
        var controller = fixture.CreateController();
        TestHttp.SetYamlBody(controller, """
            pluginId: invalid
            displayName: Invalid
            fields: []
            steps:
              - name: profile
                method: GET
                url: "/"
                responseType: html
            dashboard:
              metrics: []
            """);

        var result = await controller.Create(CancellationToken.None);

        var badRequest = result.ShouldBeOfType<BadRequestObjectResult>();
        TestHttp.ToJson(badRequest.Value).GetProperty("error").GetString()
            .ShouldBe("Plugin definition must define at least one dashboard metric.");
    }

    [Fact]
    public async Task Create_should_write_plugin_yaml_to_relative_plugins_directory_from_content_root()
    {
        using var fixture = new PluginsFixture(usePluginsDirectory: true, relativePluginsDirectory: "plugins");
        var controller = fixture.CreateController();
        TestHttp.SetYamlBody(controller, """
            pluginId: relative-plugin
            displayName: Relative Plugin
            fields: []
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
            """);

        var result = await controller.Create(CancellationToken.None);

        result.ShouldBeOfType<CreatedAtActionResult>();
        File.Exists(Path.Combine(fixture.PluginsDirectory, "relative-plugin.yaml")).ShouldBeTrue();
    }

    private sealed class PluginsFixture : IDisposable
    {
        public PluginsFixture(bool usePluginsDirectory = true, string? relativePluginsDirectory = null)
        {
            RootDirectory = Path.Combine(Path.GetTempPath(), $"trackerstats-plugins-{Guid.NewGuid():N}");
            PluginsDirectory = relativePluginsDirectory is null
                ? Path.Combine(RootDirectory, "plugins")
                : Path.Combine(RootDirectory, relativePluginsDirectory);
            Directory.CreateDirectory(PluginsDirectory);
            UsePluginsDirectory = usePluginsDirectory;
            RelativePluginsDirectory = relativePluginsDirectory;
        }

        public string RootDirectory { get; }
        public string PluginsDirectory { get; }
        private bool UsePluginsDirectory { get; }
        private string? RelativePluginsDirectory { get; }

        public PluginsController CreateController()
        {
            var values = new Dictionary<string, string?>();

            if (UsePluginsDirectory)
                values["Plugins:Directory"] = RelativePluginsDirectory ?? PluginsDirectory;

            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(values)
                .Build();
            var hostEnvironment = new FakeHostEnvironment(RootDirectory);
            var loader = new YamlPluginDefinitionLoader(configuration, new FakeApplicationSettingsService(), hostEnvironment);
            return new PluginsController(loader, configuration, hostEnvironment);
        }

        public void Dispose()
        {
            if (Directory.Exists(RootDirectory))
                Directory.Delete(RootDirectory, recursive: true);
        }
    }
}
