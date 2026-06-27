namespace Wpd.Application.Services.Admin;

public class AdminRecordAccessRequestDto
{
    public string RecordType { get; set; } = string.Empty;
    public string RecordId { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
}

public class AdminRecordAccessResultDto
{
    public string RecordType { get; init; } = string.Empty;
    public string RecordId { get; init; } = string.Empty;
    public int ResultCount { get; init; }
    public Dictionary<string, object?> Data { get; init; } = new();
}

public class AdminRecordAccessHistoryDto
{
    public long Id { get; init; }
    public string ActorUserId { get; init; } = string.Empty;
    public string RecordType { get; init; } = string.Empty;
    public string RecordId { get; init; } = string.Empty;
    public string Reason { get; init; } = string.Empty;
    public int ResultCount { get; init; }
    public DateTime CreatedAt { get; init; }
}
