using FluentValidation;
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

                var validation = configurationValidator.Validate(request.PluginId, request.Payload);
                if (!validation.IsValid && validation.Error is not null)
                    context.AddFailure(nameof(request.Payload), validation.Error);
            });
    }
}
