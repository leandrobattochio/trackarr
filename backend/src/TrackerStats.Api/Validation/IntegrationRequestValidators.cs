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

                var payload = IntegrationRequestValidationHelpers.ParsePayload(request.Payload);
                var baseUrl = payload.GetValueOrDefault("baseUrl");
                var baseUrlValidator = new InlineValidator<string?>();
                baseUrlValidator.RuleFor(value => value)
                    .Must(value => string.IsNullOrWhiteSpace(value) || IntegrationRequestValidationHelpers.IsValidTrackerUrl(value))
                    .WithMessage("Field 'baseUrl' must be a valid http:// or https:// URL.");

                var baseUrlResult = baseUrlValidator.Validate(baseUrl);
                if (!baseUrlResult.IsValid)
                {
                    foreach (var error in baseUrlResult.Errors)
                        context.AddFailure(nameof(request.Payload), error.ErrorMessage);
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

                var payload = IntegrationRequestValidationHelpers.ParsePayload(request.Payload);
                var baseUrl = payload.GetValueOrDefault("baseUrl");
                var baseUrlValidator = new InlineValidator<string?>();
                baseUrlValidator.RuleFor(value => value)
                    .Must(value => string.IsNullOrWhiteSpace(value) || IntegrationRequestValidationHelpers.IsValidTrackerUrl(value))
                    .WithMessage("Field 'baseUrl' must be a valid http:// or https:// URL.");

                var baseUrlResult = baseUrlValidator.Validate(baseUrl);
                if (!baseUrlResult.IsValid)
                {
                    foreach (var error in baseUrlResult.Errors)
                        context.AddFailure(nameof(request.Payload), error.ErrorMessage);
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
        catch
        {
            return [];
        }
    }

    public static bool IsValidTrackerUrl(string value)
    {
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri))
            return false;

        if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            return false;

        var hostType = Uri.CheckHostName(uri.Host);
        return hostType switch
        {
            UriHostNameType.IPv4 => true,
            UriHostNameType.IPv6 => true,
            UriHostNameType.Dns => string.Equals(uri.Host, "localhost", StringComparison.OrdinalIgnoreCase) || uri.Host.Contains('.', StringComparison.Ordinal),
            _ => false
        };
    }
}
