namespace Wpd.Api.DTOs.Admin;

public class UpdateUserRoleRequest
{
    public string Role { get; set; } = string.Empty;
    public string? Reason { get; set; }
}
