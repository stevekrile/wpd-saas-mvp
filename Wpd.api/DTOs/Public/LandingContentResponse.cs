namespace Wpd.Api.DTOs.Public;

public class LandingContentResponse
{
    public string Title { get; set; } = string.Empty;
    public string Subtitle { get; set; } = string.Empty;
    public List<string> Highlights { get; set; } = new();
    public List<string> DistressSignals { get; set; } = new();
    public string CallToActionText { get; set; } = string.Empty;
    public string CallToActionRoute { get; set; } = string.Empty;
}
