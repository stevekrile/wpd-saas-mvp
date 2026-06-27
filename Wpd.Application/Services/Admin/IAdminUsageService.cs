namespace Wpd.Application.Services.Admin;

public interface IAdminUsageService
{
    Task<AdminQueryResult<AdminUsageSummaryDto>> GetUsageSummaryAsync(
        string actorUserId,
        string actorRole,
        DateTime fromUtc,
        DateTime toUtc,
        int? workspaceId);

    Task<AdminQueryResult<AdminUserUsageDto>> GetUserUsageAsync(
        string actorUserId,
        string actorRole,
        string targetUserId,
        DateTime fromUtc,
        DateTime toUtc);

    Task<AdminQueryResult<IReadOnlyList<AdminAiTokenUsageRowDto>>> GetAiTokenUsageAsync(
        string actorUserId,
        string actorRole,
        DateTime fromUtc,
        DateTime toUtc,
        int? workspaceId);
}
