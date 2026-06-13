namespace Wpd.Api.DTOs.Auth;

public class UserResponse
{
    public string UserId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public int SubscriptionTierId { get; set; }
    public string SubscriptionTierName { get; set; } = string.Empty;
    public int? DefaultWorkspaceId { get; set; }
}