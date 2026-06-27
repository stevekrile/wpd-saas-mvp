namespace Wpd.Domain.Entities;

public class AdminRecordAccessEvent
{
    public long Id { get; set; }
    public string ActorUserId { get; set; } = string.Empty;
    public string RecordType { get; set; } = string.Empty;
    public string RecordId { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public int ResultCount { get; set; }
    public DateTime CreatedAt { get; set; }
}
