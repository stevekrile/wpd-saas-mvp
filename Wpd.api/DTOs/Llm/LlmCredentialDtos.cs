namespace Wpd.Api.DTOs.Llm;

public class UpsertLlmCredentialRequest
{
    public string ApiKey { get; set; } = string.Empty;
}

public class LlmCredentialStatusResponse
{
    public string Provider { get; set; } = string.Empty;
    public bool IsConfigured { get; set; }
    public string KeyHint { get; set; } = string.Empty;
    public DateTime? UpdatedAt { get; set; }
}
