using Wpd.Domain.Enums;

namespace Wpd.Domain.Entities;

public class LensScore
{
    public int Id { get; set; }
    public int DiagnosticId { get; set; }
    public int LensId { get; set; }
    public decimal RawScore { get; set; }
    public decimal NormalizedScore { get; set; }
    public ScoreBand ScoreBand { get; set; }
    public string SummaryText { get; set; } = string.Empty;

    // Navigation properties
    public Diagnostic Diagnostic { get; set; } = null!;
    public Lens Lens { get; set; } = null!;
}