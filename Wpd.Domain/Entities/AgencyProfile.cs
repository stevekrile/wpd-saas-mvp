namespace Wpd.Domain.Entities;

public class AgencyProfile
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public ICollection<AgencyLensAssessment> LensAssessments { get; set; } = new List<AgencyLensAssessment>();
}
