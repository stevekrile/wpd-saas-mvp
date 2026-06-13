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
    public int? PrimaryLensId { get; set; }

    // Navigation properties
    public Process Process { get; set; } = null!;
    public Lens? PrimaryLens { get; set; }
    public ICollection<DiagnosticResponse> DiagnosticResponses { get; set; } = new List<DiagnosticResponse>();
    public ICollection<LensScore> LensScores { get; set; } = new List<LensScore>();
    public ICollection<SystemTension> SystemTensions { get; set; } = new List<SystemTension>();
}