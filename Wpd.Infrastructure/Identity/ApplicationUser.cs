using Microsoft.AspNetCore.Identity;

namespace Wpd.Infrastructure.Identity;

public class ApplicationUser : IdentityUser
{
    public string DisplayName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public int? DefaultWorkspaceId { get; set; }
    public int SubscriptionTierId { get; set; }
    public int? OrganizationId { get; set; }
}