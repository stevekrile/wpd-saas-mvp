namespace Wpd.Domain.Entities;

public class WpdUser
{
    public string Id { get; set; } = string.Empty; // Clerk user ID (e.g. user_abc123)
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public int? DefaultWorkspaceId { get; set; }
    public int SubscriptionTierId { get; set; }
    public int? OrganizationId { get; set; }

    // Navigation properties
    public SubscriptionTier? SubscriptionTier { get; set; }
    public Organization? Organization { get; set; }
}
