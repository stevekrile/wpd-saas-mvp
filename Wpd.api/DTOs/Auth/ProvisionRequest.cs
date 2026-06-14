namespace Wpd.Api.DTOs.Auth;

public class ProvisionRequest
{
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
}
