namespace Wpd.Api.DTOs.Game;

public class SaveRogueBrickProgressRequest
{
    public string ProgressJson { get; set; } = string.Empty;
}

public class RogueBrickProgressResponse
{
    public string ProgressJson { get; set; } = string.Empty;
    public long UpdatedAtEpochMs { get; set; }
}
