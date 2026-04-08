using FluentValidation;
using System.Text.Json;
using TrackerStats.Domain.Plugins;
using TrackerStats.Infrastructure.Services;

namespace TrackerStats.Api.Controllers;

public sealed class CreateIntegrationRequestValidator : AbstractValidator<CreateIntegrationRequest>
{
    public CreateIntegrationRequestValidator(
        ITrackerPluginRegistry registry,
        IntegrationConfigurationValidator configurationValidator)
    {
        RuleFor(request => request.PluginId)
            .Cascade(CascadeMode.Stop)
            .NotEmpty()
            .WithMessage("PluginId is required.")
            .Must(pluginId => registry.GetById(pluginId) is not null)
            .WithMessage(request => $"Plugin '{request.PluginId}' not found.");

        RuleFor(request => request.Payload)
            .NotEmpty()
            .WithMessage("Payload is required.");

        RuleFor(request => request)
            .Custom((request, context) =>
            {
                if (string.IsNullOrWhiteSpace(request.PluginId) ||
                    string.IsNullOrWhiteSpace(request.Payload) ||
                    registry.GetById(request.PluginId) is null)
                {
                    return;
                }

                var plugin = registry.GetById(request.PluginId)!;
                var payload = IntegrationRequestValidationHelpers.ParsePayload(request.Payload);

                if (!IntegrationRequestValidationHelpers.IsAllowedBaseUrl(plugin, payload.GetValueOrDefault("baseUrl")))
                {
                    context.AddFailure(nameof(request.Payload), "Field 'baseUrl' must match one of the plugin's configured base URLs.");
                    return;
                }

                var validation = configurationValidator.Validate(request.PluginId, request.Payload);
                if (!validation.IsValid && validation.Error is not null)
                    context.AddFailure(nameof(request.Payload), validation.Error);
            });
    }
}

public sealed class UpdateIntegrationRequestValidator : AbstractValidator<UpdateIntegrationRequest>
{
    public UpdateIntegrationRequestValidator(
        ITrackerPluginRegistry registry,
        IntegrationConfigurationValidator configurationValidator)
    {
        RuleFor(request => request.PluginId)
            .Cascade(CascadeMode.Stop)
            .NotEmpty()
            .WithMessage("PluginId is required.")
            .Must(pluginId => registry.GetById(pluginId) is not null)
            .WithMessage(request => $"Plugin '{request.PluginId}' not found.");

        RuleFor(request => request.Payload)
            .NotEmpty()
            .WithMessage("Payload is required.");

        RuleFor(request => request)
            .Custom((request, context) =>
            {
                if (string.IsNullOrWhiteSpace(request.PluginId) ||
                    string.IsNullOrWhiteSpace(request.Payload) ||
                    registry.GetById(request.PluginId) is null)
                {
                    return;
                }

                var plugin = registry.GetById(request.PluginId)!;
                var payload = IntegrationRequestValidationHelpers.ParsePayload(request.Payload);

                if (!IntegrationRequestValidationHelpers.IsAllowedBaseUrl(plugin, payload.GetValueOrDefault("baseUrl")))
                {
                    context.AddFailure(nameof(request.Payload), "Field 'baseUrl' must match one of the plugin's configured base URLs.");
                    return;
                }

                var validation = configurationValidator.Validate(request.PluginId, request.Payload);
                if (!validation.IsValid && validation.Error is not null)
                    context.AddFailure(nameof(request.Payload), validation.Error);
            });
    }
}

internal static class IntegrationRequestValidationHelpers
{
    public static Dictionary<string, string?> ParsePayload(string payload)
    {
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, string?>>(payload) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
        catch (NotSupportedException)
        {
            return [];
        }
    }

    public static bool IsAllowedBaseUrl(ITrackerPlugin plugin, string? value)
    {
        if (plugin.BaseUrls.Count == 0)
            return true;

        if (string.IsNullOrWhiteSpace(value))
            return false;

        return plugin.BaseUrls.Any(baseUrl => string.Equals(baseUrl, value, StringComparison.Ordinal));
    }
}
