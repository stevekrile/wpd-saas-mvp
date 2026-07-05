namespace Wpd.Api.Services.Llm;

public interface ILlmCredentialService
{
    Task<IReadOnlyList<LlmCredentialStatus>> GetCredentialStatusesAsync(string userId);
    Task<(bool Succeeded, string Error)> SaveCredentialAsync(string userId, string provider, string apiKey);
    Task<(bool Succeeded, string Error)> RemoveCredentialAsync(string userId, string provider);
    Task<(bool Found, string ApiKey)> GetApiKeyAsync(string userId, string provider);
}

public sealed class LlmCredentialStatus
{
    public string Provider { get; init; } = string.Empty;
    public bool IsConfigured { get; init; }
    public string KeyHint { get; init; } = string.Empty;
    public DateTime? UpdatedAt { get; init; }
}
