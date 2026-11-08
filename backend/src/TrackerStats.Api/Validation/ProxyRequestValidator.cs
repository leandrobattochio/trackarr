using FluentValidation;
using TrackerStats.Api.Controllers;

namespace TrackerStats.Api.Validation;

public sealed class ProxyRequestValidator : AbstractValidator<ProxyRequest>
{
    public ProxyRequestValidator()
    {
        RuleFor(request => request.Name)
            .Must(name => !string.IsNullOrWhiteSpace(name)).WithMessage("Name is required.")
            .MaximumLength(100).WithMessage("Name must be at most 100 characters.");

        RuleFor(request => request.Type)
            .Must(type => ProxyRequest.ParseType(type) is not null)
            .WithMessage("Type must be http, socks4 or socks5.");

        RuleFor(request => request.Host)
            .Must(BeAHostName)
            .WithMessage("Host must be a host name or an IP address, with no scheme, port or path (for example 10.0.0.2 or proxy.example).");

        RuleFor(request => request.Port)
            .InclusiveBetween(1, 65535).WithMessage("Port must be between 1 and 65535.");

        RuleFor(request => request.Username)
            .MaximumLength(255).WithMessage("Username must be at most 255 characters.");

        RuleFor(request => request.Password)
            .MaximumLength(255).WithMessage("Password must be at most 255 characters.");
    }

    private static bool BeAHostName(string? host)
    {
        if (string.IsNullOrWhiteSpace(host))
            return false;

        var trimmed = host.Trim();
        return trimmed.Length <= 255
            && Uri.CheckHostName(trimmed) is UriHostNameType.Dns or UriHostNameType.IPv4 or UriHostNameType.IPv6;
    }
}
