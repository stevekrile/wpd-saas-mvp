namespace Wpd.Domain.Entities;

public class DiagnosticLensNote
{
    public int Id { get; set; }
    public int DiagnosticId { get; set; }
    public string LensKey { get; set; } = string.Empty;
    public string NoteText { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Navigation properties
    public Diagnostic Diagnostic { get; set; } = null!;
}
