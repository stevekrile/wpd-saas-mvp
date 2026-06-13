namespace Wpd.Api.DTOs.Processes;

public class ProcessResponse
{
    public int Id { get; set; }
    public int WorkspaceId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string ProblemStatement { get; set; } = string.Empty;
    public string Context { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}