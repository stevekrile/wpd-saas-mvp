namespace Wpd.Application.Services.Admin;

public interface IAdminUserService
{
    Task<IReadOnlyList<AdminUserSummaryDto>> GetUsersAsync(string actorUserId, string actorRole, int? workspaceId);
    Task<AdminUserDetailDto?> GetUserByIdAsync(string actorUserId, string actorRole, string targetUserId);
    Task<AdminMutationResult> UpdateUserRoleAsync(string actorUserId, string actorRole, string targetUserId, string role, string? reason);
    Task<AdminMutationResult> DeactivateUserAsync(string actorUserId, string actorRole, string targetUserId, string? reason);
    Task<AdminMutationResult> ReactivateUserAsync(string actorUserId, string actorRole, string targetUserId, string? reason);
    Task<AdminMutationResult> DeactivateAccountAsync(string actorUserId, string actorRole, int targetAccountId, string? reason);
    Task<AdminMutationResult> ReactivateAccountAsync(string actorUserId, string actorRole, int targetAccountId, string? reason);
}
