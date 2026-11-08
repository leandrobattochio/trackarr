using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;
using TrackerStats.Api.Controllers;
using TrackerStats.Domain.Plugins.Yaml;
using TrackerStats.Infrastructure.Plugins.Storage;
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
            schemaVersion: 1
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
            """;
        TestHttp.SetYamlBody(controller, yaml);

        var result = await controller.Create(CancellationToken.None);

        var created = result.ShouldBeOfType<CreatedAtActionResult>();
        created.RouteValues!["pluginId"].ShouldBe("test-plugin");
        File.Exists(Path.Combine(fixture.CustomDirectory, "test-plugin.yaml")).ShouldBeTrue();
    }

    [Fact]
    public async Task Create_should_return_conflict_when_plugin_already_exists()
    {
        using var fixture = new PluginsFixture();
        File.WriteAllText(Path.Combine(fixture.CustomDirectory, "test-plugin.yaml"), "pluginId: test-plugin");
        var controller = fixture.CreateController();
        TestHttp.SetYamlBody(controller, """
            pluginId: test-plugin
            displayName: Test Plugin
            schemaVersion: 1
            baseUrls:
              - https://tracker.test/
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
            schemaVersion: 1
            baseUrls:
              - https://tracker.test/
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
    public async Task Create_should_reject_plugin_with_higher_schema_version()
    {
        using var fixture = new PluginsFixture();
        var controller = fixture.CreateController();
        TestHttp.SetYamlBody(controller, """
            pluginId: future-plugin
            displayName: Future Plugin
            schemaVersion: 3
            someFutureKey: true
            """);

        var result = await controller.Create(CancellationToken.None);

        var badRequest = result.ShouldBeOfType<BadRequestObjectResult>();
        TestHttp.ToJson(badRequest.Value).GetProperty("error").GetString()
            .ShouldBe("Plugin requires schema version 3, but this trackarr supports up to 2. Update trackarr to use it.");
        File.Exists(Path.Combine(fixture.CustomDirectory, "future-plugin.yaml")).ShouldBeFalse();
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
            schemaVersion: 1
            baseUrls:
              - https://tracker.test/
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
    public void GetByPluginId_should_return_the_raw_file_content_without_reserializing()
    {
        using var fixture = new PluginsFixture();
        var rawYaml = CommentedPluginYaml("seedpool", "Seedpool");
        fixture.WritePlugin(PluginOrigin.Custom, "seedpool", rawYaml);
        var controller = fixture.CreateController();

        var result = controller.GetByPluginId("seedpool");

        var content = result.ShouldBeOfType<ContentResult>();
        content.ContentType.ShouldBe("application/yaml");
        content.Content.ShouldBe(rawYaml);
    }

    [Theory]
    [InlineData(PluginOrigin.Official)]
    [InlineData(PluginOrigin.Override)]
    [InlineData(PluginOrigin.Custom)]
    public async Task Get_then_update_should_leave_a_commented_file_byte_identical(PluginOrigin origin)
    {
        using var fixture = new PluginsFixture();
        if (origin == PluginOrigin.Override)
            fixture.WritePlugin(PluginOrigin.Official, "commented", MinimalPluginYaml("commented", "Official"));
        var path = fixture.WritePlugin(origin, "commented", CommentedPluginYaml("commented", "Commented"));
        var bytesBefore = File.ReadAllBytes(path);
        var filesBefore = Directory.EnumerateFiles(fixture.RootDirectory, "*", SearchOption.AllDirectories).Order().ToList();
        var editorContent = fixture.CreateController().GetByPluginId("commented")
            .ShouldBeOfType<ContentResult>().Content.ShouldNotBeNull();
        var controller = fixture.CreateController();
        TestHttp.SetYamlBody(controller, editorContent);

        var result = await controller.Update("commented", CancellationToken.None);

        result.ShouldBeOfType<OkObjectResult>();
        File.ReadAllBytes(path).ShouldBe(bytesBefore);
        Directory.EnumerateFiles(fixture.RootDirectory, "*", SearchOption.AllDirectories).Order().ToList().ShouldBe(filesBefore);
    }

    [Fact]
    public void GetByPluginId_should_keep_version_schema_version_and_changelog()
    {
        using var fixture = new PluginsFixture();
        File.WriteAllText(Path.Combine(fixture.CustomDirectory, "versioned.yaml"), """
            pluginId: versioned
            displayName: Versioned
            version: 1.2.0
            schemaVersion: 1
            changelog:
              - version: 1.2.0
                date: "2026-11-07"
                notes: Fixed the ratio selector.
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
            """);
        var controller = fixture.CreateController();

        var result = controller.GetByPluginId("versioned");

        var content = result.ShouldBeOfType<ContentResult>().Content.ShouldNotBeNull();
        content.ShouldContain("version: 1.2.0");
        content.ShouldContain("schemaVersion: 1");
        content.ShouldContain("notes: Fixed the ratio selector.");
    }

    [Fact]
    public void GetByPluginId_should_return_raw_yaml_for_invalid_definitions()
    {
        using var fixture = new PluginsFixture();
        var rawYaml = """
            pluginId: broken
            displayName: Broken
            baseUrls:
              - https://tracker.test/
            fields:
              - name: baseUrl
                label: Base URL
            """;
        File.WriteAllText(Path.Combine(fixture.CustomDirectory, "broken.yaml"), rawYaml);
        var controller = fixture.CreateController();

        var result = controller.GetByPluginId("broken");

        var content = result.ShouldBeOfType<ContentResult>();
        content.ContentType.ShouldBe("application/yaml");
        content.Content.ShouldBe(rawYaml);
    }

    [Fact]
    public async Task GetAll_should_return_validation_status_for_loaded_plugins()
    {
        using var fixture = new PluginsFixture();
        File.WriteAllText(Path.Combine(fixture.CustomDirectory, "valid.yaml"), """
            pluginId: valid
            displayName: Valid
            baseUrls:
              - https://tracker.test/
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
        File.WriteAllText(Path.Combine(fixture.CustomDirectory, "invalid.yaml"), """
            pluginId: invalid
            displayName: Invalid
            baseUrls:
              - https://tracker.test/
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

        var result = await controller.GetAll(CancellationToken.None);

        var ok = result.ShouldBeOfType<OkObjectResult>();
        var json = TestHttp.ToJson(ok.Value);
        json.GetArrayLength().ShouldBe(2);
        json.EnumerateArray().ShouldContain(item => item.GetProperty("pluginId").GetString() == "valid" && item.GetProperty("definitionValid").GetBoolean());
        json.EnumerateArray().ShouldContain(item => item.GetProperty("pluginId").GetString() == "invalid" && !item.GetProperty("definitionValid").GetBoolean());
    }

    [Fact]
    public async Task GetAll_should_include_custom_fields_for_valid_plugins()
    {
        using var fixture = new PluginsFixture();
        File.WriteAllText(Path.Combine(fixture.CustomDirectory, "valid.yaml"), """
            pluginId: valid
            displayName: Valid
            baseUrls:
              - https://tracker.test/
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

        var result = await controller.GetAll(CancellationToken.None);

        var ok = result.ShouldBeOfType<OkObjectResult>();
        var json = TestHttp.ToJson(ok.Value);
        json[0].GetProperty("customFields").GetArrayLength().ShouldBe(1);
        json[0].GetProperty("baseUrls")[0].GetString().ShouldBe("https://tracker.test/");
        json[0].GetProperty("customFields")[0].GetProperty("name").GetString().ShouldBe("token");
    }

    [Fact]
    public async Task GetAll_should_include_field_descriptions_for_valid_plugins()
    {
        using var fixture = new PluginsFixture();
        File.WriteAllText(Path.Combine(fixture.CustomDirectory, "valid.yaml"), """
            pluginId: valid
            displayName: Valid
            baseUrls:
              - https://tracker.test/
            fields:
              - name: cookie
                label: Cookie
                description: Copy the full Cookie header value from the tracker request.
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
            """);
        var controller = fixture.CreateController();

        var result = await controller.GetAll(CancellationToken.None);

        var ok = result.ShouldBeOfType<OkObjectResult>();
        var json = TestHttp.ToJson(ok.Value);
        json[0].GetProperty("fields").EnumerateArray()
            .Single(field => field.GetProperty("name").GetString() == "cookie")
            .GetProperty("description").GetString()
            .ShouldBe("Copy the full Cookie header value from the tracker request.");
    }

    [Theory]
    [InlineData("""
        displayName: Invalid
        schemaVersion: 1
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
        schemaVersion: 1
        baseUrls:
          - https://tracker.test/
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
        schemaVersion: 1
        baseUrls:
          - https://tracker.test/
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
        schemaVersion: 1
        baseUrls:
          - https://tracker.test/
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
        schemaVersion: 1
        baseUrls:
          - https://tracker.test/
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
        schemaVersion: 1
        baseUrls:
          - https://tracker.test/
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
        schemaVersion: 1
        baseUrls:
          - https://tracker.test/
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
        schemaVersion: 1
        baseUrls:
          - https://tracker.test/
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
        schemaVersion: 1
        baseUrls:
          - https://tracker.test/
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
        schemaVersion: 1
        baseUrls:
          - https://tracker.test/
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
        schemaVersion: 1
        baseUrls:
          - https://tracker.test/
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
        schemaVersion: 1
        baseUrls:
          - https://tracker.test/
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
        schemaVersion: 1
        baseUrls:
          - https://tracker.test/
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
    public async Task Create_should_reject_plugin_id_with_path_characters()
    {
        using var fixture = new PluginsFixture();
        var controller = fixture.CreateController();
        TestHttp.SetYamlBody(controller, """
            pluginId: ../escaped
            displayName: Escaped
            schemaVersion: 1
            baseUrls:
              - https://tracker.test/
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
        TestHttp.ToJson(badRequest.Value).GetProperty("error").GetString().ShouldStartWith("Plugin id '../escaped' is invalid.");
        Directory.EnumerateFiles(fixture.RootDirectory, "*", SearchOption.AllDirectories).ShouldBeEmpty();
    }

    [Fact]
    public async Task Update_should_reject_route_and_yaml_plugin_id_mismatch()
    {
        using var fixture = new PluginsFixture();
        File.WriteAllText(Path.Combine(fixture.CustomDirectory, "seedpool.yaml"), "pluginId: seedpool");
        var controller = fixture.CreateController();
        TestHttp.SetYamlBody(controller, """
            pluginId: other-plugin
            displayName: Other Plugin
            schemaVersion: 1
            baseUrls:
              - https://tracker.test/
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
        File.WriteAllText(Path.Combine(fixture.CustomDirectory, "seedpool.yaml"), "pluginId: seedpool");
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
            baseUrls:
              - https://tracker.test/
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
    public async Task Create_should_allow_missing_plugin_directory_and_create_it()
    {
        using var fixture = new PluginsFixture();
        Directory.Delete(fixture.CustomDirectory, recursive: true);
        var controller = fixture.CreateController();
        TestHttp.SetYamlBody(controller, """
            pluginId: created-dir
            displayName: Created Dir
            schemaVersion: 1
            baseUrls:
              - https://tracker.test/
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
        Directory.Exists(fixture.CustomDirectory).ShouldBeTrue();
    }

    [Fact]
    public async Task Create_should_reject_reserved_engine_owned_properties()
    {
        using var fixture = new PluginsFixture();
        var controller = fixture.CreateController();
        TestHttp.SetYamlBody(controller, """
            pluginId: invalid
            displayName: Invalid
            schemaVersion: 1
            baseUrls:
              - https://tracker.test/
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
            schemaVersion: 1
            baseUrls:
              - https://tracker.test/
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
    public async Task Create_should_write_plugin_yaml_under_relative_data_directory_from_content_root()
    {
        using var fixture = new PluginsFixture(relativeDataDirectory: "data");
        var controller = fixture.CreateController();
        TestHttp.SetYamlBody(controller, """
            pluginId: relative-plugin
            displayName: Relative Plugin
            schemaVersion: 1
            baseUrls:
              - https://tracker.test/
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
        File.Exists(Path.Combine(fixture.RootDirectory, "data", "plugins", "custom", "relative-plugin.yaml")).ShouldBeTrue();
    }

    [Fact]
    public async Task Update_should_return_not_found_when_plugin_only_exists_under_a_different_filename()
    {
        using var fixture = new PluginsFixture();
        var existingPath = Path.Combine(fixture.CustomDirectory, "custom-file.yaml");
        File.WriteAllText(existingPath, MinimalPluginYaml("seedpool", "Seedpool"));
        var controller = fixture.CreateController();
        TestHttp.SetYamlBody(controller, MinimalPluginYaml("seedpool", "Updated Seedpool"));

        var result = await controller.Update("seedpool", CancellationToken.None);

        result.ShouldBeOfType<NotFoundResult>();
        File.ReadAllText(existingPath).ShouldBe(MinimalPluginYaml("seedpool", "Seedpool"));
        File.Exists(Path.Combine(fixture.CustomDirectory, "seedpool.yaml")).ShouldBeFalse();
    }

    [Theory]
    [InlineData(PluginOrigin.Official)]
    [InlineData(PluginOrigin.Override)]
    [InlineData(PluginOrigin.Custom)]
    public async Task Create_should_return_conflict_when_id_exists_in_any_plugin_folder(PluginOrigin origin)
    {
        using var fixture = new PluginsFixture();
        fixture.WritePlugin(origin, "taken", MinimalPluginYaml("taken", "Taken"));
        var controller = fixture.CreateController();
        TestHttp.SetYamlBody(controller, MinimalPluginYaml("taken", "Mine"));

        var result = await controller.Create(CancellationToken.None);

        result.ShouldBeOfType<ConflictObjectResult>();
        File.ReadAllText(fixture.Layout.GetPluginPath(origin, "taken")).ShouldBe(MinimalPluginYaml("taken", "Taken"));
    }

    [Fact]
    public async Task Create_should_write_new_plugins_to_the_custom_folder_only()
    {
        using var fixture = new PluginsFixture();
        var controller = fixture.CreateController();
        TestHttp.SetYamlBody(controller, MinimalPluginYaml("brand-new", "Brand New"));

        await controller.Create(CancellationToken.None);

        Directory.EnumerateFiles(fixture.RootDirectory, "*", SearchOption.AllDirectories)
            .ShouldBe([fixture.Layout.GetPluginPath(PluginOrigin.Custom, "brand-new")]);
    }

    [Theory]
    [InlineData("..%2Fescaped")]
    [InlineData("../escaped")]
    [InlineData("Seedpool")]
    [InlineData("bad_id")]
    public async Task Get_and_update_should_reject_route_ids_failing_the_plugin_id_rule(string pluginId)
    {
        using var fixture = new PluginsFixture();
        var controller = fixture.CreateController();
        TestHttp.SetYamlBody(controller, MinimalPluginYaml("escaped", "Escaped"));

        var getResult = controller.GetByPluginId(pluginId);
        var updateResult = await controller.Update(pluginId, CancellationToken.None);

        TestHttp.ToJson(getResult.ShouldBeOfType<BadRequestObjectResult>().Value).GetProperty("error").GetString()
            .ShouldStartWith($"Plugin id '{pluginId}' is invalid.");
        updateResult.ShouldBeOfType<BadRequestObjectResult>();
        Directory.EnumerateFiles(fixture.RootDirectory, "*", SearchOption.AllDirectories).ShouldBeEmpty();
    }

    [Fact]
    public void GetByPluginId_should_return_the_override_when_it_shadows_an_official_plugin()
    {
        using var fixture = new PluginsFixture();
        fixture.WritePlugin(PluginOrigin.Official, "asc", MinimalPluginYaml("asc", "Official ASC"));
        fixture.WritePlugin(PluginOrigin.Override, "asc", MinimalPluginYaml("asc", "My ASC"));
        var controller = fixture.CreateController();

        var content = controller.GetByPluginId("asc").ShouldBeOfType<ContentResult>().Content.ShouldNotBeNull();

        content.ShouldContain("displayName: My ASC");
    }

    [Fact]
    public void GetByPluginId_should_return_the_custom_when_it_shadows_an_official_plugin()
    {
        using var fixture = new PluginsFixture();
        fixture.WritePlugin(PluginOrigin.Official, "shared", MinimalPluginYaml("shared", "Official"));
        fixture.WritePlugin(PluginOrigin.Custom, "shared", MinimalPluginYaml("shared", "Custom"));
        var controller = fixture.CreateController();

        var content = controller.GetByPluginId("shared").ShouldBeOfType<ContentResult>().Content.ShouldNotBeNull();

        content.ShouldContain("displayName: Custom");
    }

    [Theory]
    [InlineData(PluginOrigin.Override)]
    [InlineData(PluginOrigin.Custom)]
    public async Task Update_should_write_the_effective_file_and_leave_the_official_untouched(PluginOrigin effectiveOrigin)
    {
        using var fixture = new PluginsFixture();
        var officialPath = fixture.WritePlugin(PluginOrigin.Official, "asc", MinimalPluginYaml("asc", "Official"));
        var effectivePath = fixture.WritePlugin(effectiveOrigin, "asc", MinimalPluginYaml("asc", "Before"));
        var controller = fixture.CreateController();
        TestHttp.SetYamlBody(controller, MinimalPluginYaml("asc", "After"));

        var result = await controller.Update("asc", CancellationToken.None);

        result.ShouldBeOfType<OkObjectResult>();
        File.ReadAllText(effectivePath).ShouldBe(MinimalPluginYaml("asc", "After"));
        File.ReadAllText(officialPath).ShouldBe(MinimalPluginYaml("asc", "Official"));
    }

    [Fact]
    public async Task Editor_and_runtime_should_agree_when_two_files_declare_the_same_id()
    {
        using var fixture = new PluginsFixture();
        fixture.WritePlugin(PluginOrigin.Custom, "dup", MinimalPluginYaml("dup", "First"));
        File.WriteAllText(Path.Combine(fixture.CustomDirectory, "dup-copy.yaml"), MinimalPluginYaml("dup", "Second"));
        var controller = fixture.CreateController();

        var plugins = TestHttp.ToJson((await controller.GetAll(CancellationToken.None)).ShouldBeOfType<OkObjectResult>().Value).EnumerateArray().ToList();
        var editorContent = controller.GetByPluginId("dup").ShouldBeOfType<ContentResult>().Content;

        var dup = plugins.Single(plugin => plugin.GetProperty("pluginId").GetString() == "dup");
        dup.GetProperty("definitionValid").GetBoolean().ShouldBeFalse();
        dup.GetProperty("definitionError").GetString().ShouldNotBeNull().ShouldContain("declared by more than one file");
        editorContent.ShouldBe(MinimalPluginYaml("dup", "First"));
    }

    private static string CommentedPluginYaml(string pluginId, string displayName) => $$"""
        # Maintained by hand; keep the comments.
        pluginId: {{pluginId}}
        displayName: '{{displayName}}'   # quoted on purpose
        version: 1.0.0
        schemaVersion: 1

        baseUrls:
          - https://tracker.test/ # main mirror
        fields: []
        steps:
          # profile page holds every stat
          - name: profile
            method: GET
            url: "/"
            responseType: html
        dashboard:
          metrics:
            - { stat: ratio, label: Ratio }

        """;

    private static string MinimalPluginYaml(string pluginId, string displayName) => $"""
        pluginId: {pluginId}
        displayName: {displayName}
        schemaVersion: 1
        baseUrls:
          - https://tracker.test/
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

    private sealed class PluginsFixture : IDisposable
    {
        private readonly string? _relativeDataDirectory;

        public PluginsFixture(string? relativeDataDirectory = null)
        {
            RootDirectory = Path.Combine(Path.GetTempPath(), $"trackerstats-plugins-{Guid.NewGuid():N}");
            _relativeDataDirectory = relativeDataDirectory;
            Layout = PluginStorageLayout.ForDataDirectory(Path.Combine(RootDirectory, relativeDataDirectory ?? ""));
            Directory.CreateDirectory(CustomDirectory);
        }

        public string RootDirectory { get; }
        public PluginStorageLayout Layout { get; }
        public InMemoryIntegrationRepository Integrations { get; } = new();

        public string CustomDirectory => Layout.CustomDirectory;

        public string WritePlugin(PluginOrigin origin, string pluginId, string content)
        {
            var path = Layout.GetPluginPath(origin, pluginId);
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            File.WriteAllText(path, content);
            return path;
        }

        public PluginsController CreateController()
        {
            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    [PluginStorageLayout.DataDirectoryKey] = _relativeDataDirectory ?? Layout.DataDirectory
                })
                .Build();
            var layout = new PluginStorageLayout(configuration, new FakeHostEnvironment(RootDirectory));
            var loader = new YamlPluginDefinitionLoader(layout, new PluginBaseStore(layout), new FakeApplicationSettingsService());
            var overrides = new PluginOverrideService(layout, new PluginStateStore(layout), new PluginBaseStore(layout), NullLogger<PluginOverrideService>.Instance);
            var stateStore = new PluginStateStore(layout);
            return new PluginsController(loader, layout, overrides, stateStore, new PluginBaseStore(layout), new PluginStatusService(loader, layout, stateStore), Integrations);
        }

        public void Dispose()
        {
            if (Directory.Exists(RootDirectory))
                Directory.Delete(RootDirectory, recursive: true);
        }
    }
}
