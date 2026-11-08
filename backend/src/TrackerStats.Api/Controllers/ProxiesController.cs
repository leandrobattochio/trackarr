using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using TrackerStats.Domain.Entities;
using TrackerStats.Domain.Plugins;
using TrackerStats.Domain.Repositories;
using TrackerStats.Infrastructure.Proxies;

namespace TrackerStats.Api.Controllers;

[ApiController]
[Route("api/proxies")]
public sealed class ProxiesController(
    IProxyRepository repository,
    ITrackerPluginRegistry registry,
    ProxyConnectionTester tester,
    IValidator<ProxyRequest> validator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct) =>
        Ok((await repository.ListAsync(ct)).Select(ToResponse));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ProxyRequest request, CancellationToken ct)
    {
        var error = await ValidateAsync(request, null, ct);
        if (error is not null)
            return error;

        var proxy = new TrackerProxy { Id = Guid.NewGuid() };
        Apply(proxy, request);
        await repository.AddAsync(proxy, ct);
        return CreatedAtAction(nameof(List), new { id = proxy.Id }, ToResponse(proxy));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] ProxyRequest request, CancellationToken ct)
    {
        var proxy = await repository.GetByIdAsync(id, ct);
        if (proxy is null)
            return NotFound();

        var error = await ValidateAsync(request, id, ct);
        if (error is not null)
            return error;

        Apply(proxy, request);
        await repository.UpdateAsync(proxy, ct);
        return Ok(ToResponse(proxy));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var proxy = await repository.GetByIdAsync(id, ct);
        if (proxy is null)
            return NotFound();

        var usedBy = await repository.ListIntegrationsUsingAsync(id, ct);
        if (usedBy.Count > 0)
        {
            return Conflict(new
            {
                error = $"Proxy '{proxy.Name}' is used by {usedBy.Count} integration(s). " +
                        "Pick another proxy, or none, in those integrations first.",
                integrations = usedBy.Select(integration => new
                {
                    id = integration.Id,
                    name = registry.GetById(integration.PluginId)?.DisplayName ?? integration.PluginId
                })
            });
        }

        await repository.DeleteAsync(proxy, ct);
        return NoContent();
    }

    [HttpPost("test")]
    public async Task<IActionResult> Test([FromBody] ProxyTestRequest request, CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(request.Proxy, ct);
        if (!validation.IsValid)
            return BadRequest(new { error = JoinErrors(validation) });

        var proxy = new TrackerProxy();
        if (request.Id is { } id)
        {
            var stored = await repository.GetByIdAsync(id, ct);
            if (stored is null)
                return NotFound();
            proxy.Password = stored.Password;
        }

        Apply(proxy, request.Proxy);
        var result = await tester.TestAsync(proxy, ct);
        return Ok(new
        {
            success = result.Success,
            testUrl = result.TestUrl,
            statusCode = result.StatusCode,
            error = result.Error
        });
    }

    private async Task<BadRequestObjectResult?> ValidateAsync(ProxyRequest request, Guid? id, CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return BadRequest(new { error = JoinErrors(validation) });

        if (await repository.NameExistsAsync(request.Name.Trim(), id, ct))
            return BadRequest(new { error = $"A proxy named '{request.Name.Trim()}' already exists." });

        return null;
    }

    private static string JoinErrors(FluentValidation.Results.ValidationResult validation) =>
        string.Join(" ", validation.Errors.Select(error => error.ErrorMessage).Distinct());

    // A null password keeps the stored one, so the UI can save a proxy without asking for it again.
    private static void Apply(TrackerProxy proxy, ProxyRequest request)
    {
        proxy.Name = request.Name.Trim();
        proxy.Type = ProxyRequest.ParseType(request.Type)!.Value;
        proxy.Host = request.Host.Trim();
        proxy.Port = request.Port;
        proxy.Username = string.IsNullOrWhiteSpace(request.Username) ? null : request.Username.Trim();
        if (proxy.Username is null)
            proxy.Password = null;
        else if (request.Password is not null)
            proxy.Password = request.Password.Length == 0 ? null : request.Password;
    }

    private static object ToResponse(TrackerProxy proxy) => new
    {
        id = proxy.Id,
        name = proxy.Name,
        type = ProxyRequest.FormatType(proxy.Type),
        host = proxy.Host,
        port = proxy.Port,
        username = proxy.Username,
        hasPassword = !string.IsNullOrEmpty(proxy.Password)
    };
}

public sealed record ProxyRequest(string Name, string Type, string Host, int Port, string? Username, string? Password)
{
    public static TrackerProxyType? ParseType(string? type) => type?.Trim().ToLowerInvariant() switch
    {
        "http" => TrackerProxyType.Http,
        "socks4" => TrackerProxyType.Socks4,
        "socks5" => TrackerProxyType.Socks5,
        _ => null
    };

    public static string FormatType(TrackerProxyType type) => type.ToString().ToLowerInvariant();
}

public sealed record ProxyTestRequest(Guid? Id, ProxyRequest Proxy);
