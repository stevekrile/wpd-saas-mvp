namespace Wpd.Domain.Entities;

public class UserGameProgress
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string ProgressJson { get; set; } = string.Empty;
    public DateTime UpdatedAtUtc { get; set; }

    public WpdUser? User { get; set; }
}
