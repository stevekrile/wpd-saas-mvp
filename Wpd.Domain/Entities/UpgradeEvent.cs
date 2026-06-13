namespace Wpd.Domain.Entities;

public class UpgradeEvent
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string EventType { get; set; } = string.Empty;
    public string SourceFeature { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}