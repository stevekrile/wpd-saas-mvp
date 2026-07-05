namespace Wpd.Domain.Entities;

public class AgencyLensAssessment
{
    public int Id { get; set; }
    public int AgencyProfileId { get; set; }
    public string LensKey { get; set; } = string.Empty;
    public string LensName { get; set; } = string.Empty;
    public int StatementNumber { get; set; }
    public string StatementText { get; set; } = string.Empty;
    public int AgencyScore { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public AgencyProfile AgencyProfile { get; set; } = null!;
}
