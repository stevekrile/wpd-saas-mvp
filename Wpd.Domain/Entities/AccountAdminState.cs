namespace Wpd.Domain.Entities;

public class AccountAdminState
{
    public int AccountId { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime? DeactivatedAt { get; set; }
    public string? DeactivatedByUserId { get; set; }
    public string? DeactivationReason { get; set; }
}
