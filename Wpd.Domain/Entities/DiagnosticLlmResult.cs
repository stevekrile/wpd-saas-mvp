namespace Wpd.Domain.Entities;

public class DiagnosticLlmResult
{
    public int Id { get; set; }
    public int DiagnosticId { get; set; }
    public string ResultMarkdown { get; set; } = string.Empty;
    public string? Provider { get; set; }
    public string? Model { get; set; }
    public int? PromptTokens { get; set; }
    public int? CompletionTokens { get; set; }
    public int? TotalTokens { get; set; }
    public DateTime CreatedAt { get; set; }

    public Diagnostic Diagnostic { get; set; } = null!;
}
