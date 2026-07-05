using Microsoft.AspNetCore.DataProtection;

namespace Wpd.Api.Services.Llm;

public sealed class LlmApiKeyProtector : ILlmApiKeyProtector
{
    private readonly IDataProtector _protector;

    public LlmApiKeyProtector(IDataProtectionProvider dataProtectionProvider)
    {
        _protector = dataProtectionProvider.CreateProtector("Wpd.Api.LlmApiKeys.v1");
    }

    public string Protect(string plainTextApiKey) => _protector.Protect(plainTextApiKey);

    public string Unprotect(string encryptedApiKey) => _protector.Unprotect(encryptedApiKey);

    public string BuildKeyHint(string plainTextApiKey)
    {
        var trimmed = plainTextApiKey.Trim();
        if (trimmed.Length <= 4)
        {
            return $"****{trimmed}";
        }

        return $"****{trimmed[^4..]}";
    }
}
