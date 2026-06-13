namespace Wpd.Domain.Entities;

public class DiagnosticQuestion
{
    public int Id { get; set; }
    public int LensId { get; set; }
    public string QuestionText { get; set; } = string.Empty;
    public string HelpText { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public bool IsRequired { get; set; }
    public bool IsActive { get; set; }
    public bool FreeTierVisible { get; set; }
    public decimal Weight { get; set; }

    // Navigation properties
    public Lens Lens { get; set; } = null!;
    public ICollection<DiagnosticResponse> DiagnosticResponses { get; set; } = new List<DiagnosticResponse>();
}