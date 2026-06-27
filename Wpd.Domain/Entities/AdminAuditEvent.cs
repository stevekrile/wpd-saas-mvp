namespace Wpd.Domain.Entities;

public class AdminAuditEvent
{
    public long Id { get; set; }
    public string ActorUserId { get; set; } = string.Empty;
    public string ActorRole { get; set; } = string.Empty;
    public string ActionType { get; set; } = string.Empty;
    public string TargetType { get; set; } = string.Empty;
    public string TargetId { get; set; } = string.Empty;
    public int? WorkspaceId { get; set; }
    public int? AccountId { get; set; }
    public string? Reason { get; set; }
    public string MetadataJson { get; set; } = "{}";
    public DateTime CreatedAt { get; set; }
}
