namespace Wpd.Application.Services.Admin;

public class AdminUsageSummaryDto
{
    public DateTime FromUtc { get; init; }
    public DateTime ToUtc { get; init; }
    public int? WorkspaceId { get; init; }
    public int? AccountId { get; init; }
    public int UsersInScope { get; init; }
    public int ProcessesCreated { get; init; }
    public int DiagnosticsCreated { get; init; }
    public int DiagnosticResponsesSaved { get; init; }
    public int UpgradeEvents { get; init; }
    public int AiRequestCount { get; init; }
    public int AiInputTokenCount { get; init; }
    public int AiOutputTokenCount { get; init; }
    public int AiTotalTokenCount { get; init; }
}

public class AdminUserUsageDto
{
    public string UserId { get; init; } = string.Empty;
    public DateTime FromUtc { get; init; }
    public DateTime ToUtc { get; init; }
    public int ProcessesCreated { get; init; }
    public int DiagnosticsCreated { get; init; }
    public int DiagnosticResponsesSaved { get; init; }
    public int UpgradeEvents { get; init; }
    public int AiRequestCount { get; init; }
    public int AiInputTokenCount { get; init; }
    public int AiOutputTokenCount { get; init; }
    public int AiTotalTokenCount { get; init; }
}

public class AdminAiTokenUsageRowDto
{
    public string Provider { get; init; } = "unknown";
    public string Model { get; init; } = "unknown";
    public int RequestCount { get; init; }
    public int InputTokenCount { get; init; }
    public int OutputTokenCount { get; init; }
    public int TotalTokenCount { get; init; }
    public int EstimatedUsageCount { get; init; }
}
