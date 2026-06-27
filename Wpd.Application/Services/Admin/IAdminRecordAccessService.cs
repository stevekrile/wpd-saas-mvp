namespace Wpd.Application.Services.Admin;

public interface IAdminRecordAccessService
{
    Task<AdminQueryResult<AdminRecordAccessResultDto>> QueryRecordAsync(
        string actorUserId,
        string actorRole,
        string recordType,
        string recordId,
        string reason);

    Task<AdminQueryResult<IReadOnlyList<AdminRecordAccessHistoryDto>>> GetHistoryAsync(
        string actorUserId,
        string actorRole,
        DateTime fromUtc,
        DateTime toUtc,
        string? actorFilterUserId);
}
