using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wpd.Api.DTOs.Llm;
using Wpd.Api.Services.Llm;

namespace Wpd.Api.Controllers;

[ApiController]
[Route("api/llm-credentials")]
[Authorize]
public class LlmCredentialsController : ControllerBase
{
    private readonly ILlmCredentialService _credentialService;
    private readonly ILlmHarnessService _llmHarnessService;

    public LlmCredentialsController(ILlmCredentialService credentialService, ILlmHarnessService llmHarnessService)
    {
        _credentialService = credentialService;
        _llmHarnessService = llmHarnessService;
    }

    [HttpGet]
    public async Task<IActionResult> GetStatuses()
    {
        var userId = GetUserId();
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized();
        }

        var statuses = await _credentialService.GetCredentialStatusesAsync(userId);
        return Ok(statuses.Select(status => new LlmCredentialStatusResponse
        {
            Provider = status.Provider,
            IsConfigured = status.IsConfigured,
            KeyHint = status.KeyHint,
            UpdatedAt = status.UpdatedAt
        }));
    }

    [HttpPut("{provider}")]
    public async Task<IActionResult> SaveCredential(string provider, [FromBody] UpsertLlmCredentialRequest request)
    {
        var userId = GetUserId();
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized();
        }

        var normalizedProvider = LlmProviderCatalog.Normalize(provider);
        if (!LlmProviderCatalog.IsSupported(normalizedProvider))
        {
            return BadRequest(new { error = $"Unsupported provider '{provider}'." });
        }

        var (succeeded, error) = await _credentialService.SaveCredentialAsync(userId, normalizedProvider, request.ApiKey);
        if (!succeeded)
        {
            return BadRequest(new { error });
        }

        return NoContent();
    }

    [HttpDelete("{provider}")]
    public async Task<IActionResult> RemoveCredential(string provider)
    {
        var userId = GetUserId();
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized();
        }

        var normalizedProvider = LlmProviderCatalog.Normalize(provider);
        if (!LlmProviderCatalog.IsSupported(normalizedProvider))
        {
            return BadRequest(new { error = $"Unsupported provider '{provider}'." });
        }

        var (succeeded, error) = await _credentialService.RemoveCredentialAsync(userId, normalizedProvider);
        if (!succeeded)
        {
            return NotFound(new { error });
        }

        return NoContent();
    }

    [HttpPost("{provider}/test")]
    public async Task<IActionResult> TestCredential(string provider, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized();
        }

        var normalizedProvider = LlmProviderCatalog.Normalize(provider);
        if (!LlmProviderCatalog.IsSupported(normalizedProvider))
        {
            return BadRequest(new { error = $"Unsupported provider '{provider}'." });
        }

        var result = await _llmHarnessService.SendPromptAsync(
            userId,
            normalizedProvider,
            "Reply with exactly: CONNECTED",
            cancellationToken);

        if (!result.Succeeded)
        {
            return BadRequest(new { error = result.Error });
        }

        return Ok(new
        {
            provider = result.Provider,
            model = result.Model,
            succeeded = true
        });
    }

    private string GetUserId() =>
        User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? string.Empty;
}
