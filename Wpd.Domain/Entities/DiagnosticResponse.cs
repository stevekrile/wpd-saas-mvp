namespace Wpd.Domain.Entities;

public class DiagnosticResponse
{
    public int Id { get; set; }
    public int DiagnosticId { get; set; }
    public int DiagnosticQuestionId { get; set; }
    public int? NumericResponse { get; set; }
    public string TextResponse { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Navigation properties
    public Diagnostic Diagnostic { get; set; } = null!;
    public DiagnosticQuestion DiagnosticQuestion { get; set; } = null!;
}