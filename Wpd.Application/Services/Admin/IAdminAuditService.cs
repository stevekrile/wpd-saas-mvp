using Wpd.Domain.Entities;

namespace Wpd.Application.Services.Admin;

public interface IAdminAuditService
{
    Task<AdminAuditEvent> WriteAuditEventAsync(
        string actorUserId,
        string actorRole,
        string actionType,
        string targetType,
        string targetId,
        int? workspaceId,
        int? accountId,
        string? reason,
        string metadataJson);

    Task<AdminRecordAccessEvent> WriteRecordAccessEventAsync(
        string actorUserId,
        string recordType,
        string recordId,
        string reason,
        int resultCount);
}
