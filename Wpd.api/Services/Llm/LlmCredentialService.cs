using Microsoft.EntityFrameworkCore;
using Wpd.Domain.Entities;
using Wpd.Infrastructure.Data;

namespace Wpd.Api.Services.Llm;

public sealed class LlmCredentialService : ILlmCredentialService
{
    private readonly ApplicationDbContext _context;
    private readonly ILlmApiKeyProtector _apiKeyProtector;

    public LlmCredentialService(ApplicationDbContext context, ILlmApiKeyProtector apiKeyProtector)
    {
        _context = context;
        _apiKeyProtector = apiKeyProtector;
    }

    public async Task<IReadOnlyList<LlmCredentialStatus>> GetCredentialStatusesAsync(string userId)
    {
        var credentials = await _context.UserLlmCredentials
            .Where(c => c.UserId == userId)
            .ToListAsync();

        return LlmProviderCatalog.SupportedProviders
            .Select(provider =>
            {
                var credential = credentials.FirstOrDefault(c => c.Provider == provider);
                return new LlmCredentialStatus
                {
                    Provider = provider,
                    IsConfigured = credential != null,
                    KeyHint = credential?.KeyHint ?? string.Empty,
                    UpdatedAt = credential?.UpdatedAt
                };
            })
            .ToList();
    }

    public async Task<(bool Succeeded, string Error)> SaveCredentialAsync(string userId, string provider, string apiKey)
    {
        var normalizedProvider = LlmProviderCatalog.Normalize(provider);
        if (!LlmProviderCatalog.IsSupported(normalizedProvider))
        {
            return (false, $"Unsupported provider '{provider}'.");
        }

        var trimmedApiKey = apiKey.Trim();
        if (string.IsNullOrWhiteSpace(trimmedApiKey))
        {
            return (false, "API key is required.");
        }

        var credential = await _context.UserLlmCredentials
            .FirstOrDefaultAsync(c => c.UserId == userId && c.Provider == normalizedProvider);

        if (credential == null)
        {
            credential = new UserLlmCredential
            {
                UserId = userId,
                Provider = normalizedProvider,
                CreatedAt = DateTime.UtcNow
            };
            _context.UserLlmCredentials.Add(credential);
        }

        credential.EncryptedApiKey = _apiKeyProtector.Protect(trimmedApiKey);
        credential.KeyHint = _apiKeyProtector.BuildKeyHint(trimmedApiKey);
        credential.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return (true, string.Empty);
    }

    public async Task<(bool Succeeded, string Error)> RemoveCredentialAsync(string userId, string provider)
    {
        var normalizedProvider = LlmProviderCatalog.Normalize(provider);
        if (!LlmProviderCatalog.IsSupported(normalizedProvider))
        {
            return (false, $"Unsupported provider '{provider}'.");
        }

        var credential = await _context.UserLlmCredentials
            .FirstOrDefaultAsync(c => c.UserId == userId && c.Provider == normalizedProvider);

        if (credential == null)
        {
            return (false, "Credential not found.");
        }

        _context.UserLlmCredentials.Remove(credential);
        await _context.SaveChangesAsync();
        return (true, string.Empty);
    }

    public async Task<(bool Found, string ApiKey)> GetApiKeyAsync(string userId, string provider)
    {
        var normalizedProvider = LlmProviderCatalog.Normalize(provider);
        if (!LlmProviderCatalog.IsSupported(normalizedProvider))
        {
            return (false, string.Empty);
        }

        var credential = await _context.UserLlmCredentials
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.UserId == userId && c.Provider == normalizedProvider);

        if (credential == null)
        {
            return (false, string.Empty);
        }

        return (true, _apiKeyProtector.Unprotect(credential.EncryptedApiKey));
    }
}
