namespace Wpd.Api.DTOs.Public;

public class LensPublicResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public string PublicDescription { get; set; } = string.Empty;
}
