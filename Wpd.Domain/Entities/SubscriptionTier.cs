namespace Wpd.Domain.Entities;

public class SubscriptionTier
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public int MaxActiveProcesses { get; set; }
    public bool AllowsExports { get; set; }
    public bool AllowsArtifacts { get; set; }
    public bool AllowsAiAssistance { get; set; }
    public bool AllowsTeamWorkspaces { get; set; }
    public bool AllowsEnterpriseAdmin { get; set; }
    public DateTime CreatedAt { get; set; }
}
