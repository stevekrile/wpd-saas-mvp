namespace Wpd.Application.Services.Admin;

public class AdminUserSummaryDto
{
    public string UserId { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string DisplayName { get; init; } = string.Empty;
    public int? WorkspaceId { get; init; }
    public int? AccountId { get; init; }
    public bool IsActive { get; init; }
    public string Role { get; init; } = string.Empty;
}

public class AdminUserDetailDto : AdminUserSummaryDto
{
    public DateTime CreatedAt { get; init; }
    public DateTime? LastLoginAt { get; init; }
}
