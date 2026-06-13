namespace Wpd.Domain.Entities;

public class SystemTension
{
    public int Id { get; set; }
    public int DiagnosticId { get; set; }
    public int LensId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int Severity { get; set; }
    public int SortOrder { get; set; }

    // Navigation properties
    public Diagnostic Diagnostic { get; set; } = null!;
    public Lens Lens { get; set; } = null!;
}