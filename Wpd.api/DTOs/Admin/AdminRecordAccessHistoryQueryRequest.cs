namespace Wpd.Api.DTOs.Admin;

public class AdminRecordAccessHistoryQueryRequest
{
    public DateTime? FromUtc { get; set; }
    public DateTime? ToUtc { get; set; }
    public string? ActorUserId { get; set; }
}
