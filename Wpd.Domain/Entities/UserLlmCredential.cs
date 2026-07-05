namespace Wpd.Domain.Entities;

public class UserLlmCredential
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string Provider { get; set; } = string.Empty;
    public string EncryptedApiKey { get; set; } = string.Empty;
    public string KeyHint { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public WpdUser? User { get; set; }
}
