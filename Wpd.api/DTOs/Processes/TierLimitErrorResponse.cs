namespace Wpd.Api.DTOs.Processes;

public class TierLimitErrorResponse
{
    public string Error { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string CurrentTier { get; set; } = string.Empty;
    public int CurrentProcessCount { get; set; }
    public int MaxAllowedProcesses { get; set; }
    public string UpgradePrompt { get; set; } = string.Empty;
}