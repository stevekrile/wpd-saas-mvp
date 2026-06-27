namespace Wpd.Domain.Entities;

public class UserAdminState
{
    public string UserId { get; set; } = string.Empty;
    public string? AssignedRole { get; set; }
    public int? AccountId { get; set; }
    public int? WorkspaceId { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime? DeactivatedAt { get; set; }
    public string? DeactivatedByUserId { get; set; }
    public string? DeactivationReason { get; set; }
    public DateTime? ReactivatedAt { get; set; }
    public string? ReactivatedByUserId { get; set; }
}
