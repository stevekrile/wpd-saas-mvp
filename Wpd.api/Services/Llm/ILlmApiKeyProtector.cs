namespace Wpd.Api.Services.Llm;

public interface ILlmApiKeyProtector
{
    string Protect(string plainTextApiKey);
    string Unprotect(string encryptedApiKey);
    string BuildKeyHint(string plainTextApiKey);
}
