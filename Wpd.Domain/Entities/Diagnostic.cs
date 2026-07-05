using Wpd.Domain.Enums;

namespace Wpd.Domain.Entities;

public class Diagnostic
{
    public int Id { get; set; }
    public int ProcessId { get; set; }
    public string UserId { get; set; } = string.Empty;
    public DiagnosticStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public string OverallSummary { get; set; } = string.Empty;
    public string? CurrentLlmProvider { get; set; }
    public string? CurrentLlmModel { get; set; }
    public int? CurrentLlmPromptTokens { get; set; }
    public int? CurrentLlmCompletionTokens { get; set; }
    public int? CurrentLlmTotalTokens { get; set; }
    public int? PrimaryLensId { get; set; }

    // Navigation properties
    public Process Process { get; set; } = null!;
    public Lens? PrimaryLens { get; set; }
    public ICollection<DiagnosticResponse> DiagnosticResponses { get; set; } = new List<DiagnosticResponse>();
    public ICollection<DiagnosticLensNote> DiagnosticLensNotes { get; set; } = new List<DiagnosticLensNote>();
    public ICollection<DiagnosticLlmResult> DiagnosticLlmResults { get; set; } = new List<DiagnosticLlmResult>();
    public ICollection<LensScore> LensScores { get; set; } = new List<LensScore>();
    public ICollection<SystemTension> SystemTensions { get; set; } = new List<SystemTension>();
}