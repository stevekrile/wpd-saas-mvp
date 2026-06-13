namespace Wpd.Api.DTOs.Processes;

public class UpdateProcessRequest
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string ProblemStatement { get; set; } = string.Empty;
    public string Context { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
}