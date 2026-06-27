using Wpd.Domain.Entities;
using Wpd.Infrastructure.Data;

namespace Wpd.Application.Services.Admin;

public class AdminAuditService : IAdminAuditService
{
    private readonly ApplicationDbContext _context;

    public AdminAuditService(ApplicationDbContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        _context = context;
    }

    public async Task<AdminAuditEvent> WriteAuditEventAsync(
        string actorUserId,
        string actorRole,
        string actionType,
        string targetType,
        string targetId,
        int? workspaceId,
        int? accountId,
        string? reason,
        string metadataJson)
    {
        if (string.IsNullOrWhiteSpace(actorUserId)) throw new ArgumentException("actorUserId is required.", nameof(actorUserId));
        if (string.IsNullOrWhiteSpace(actorRole)) throw new ArgumentException("actorRole is required.", nameof(actorRole));
        if (string.IsNullOrWhiteSpace(actionType)) throw new ArgumentException("actionType is required.", nameof(actionType));
        if (string.IsNullOrWhiteSpace(targetType)) throw new ArgumentException("targetType is required.", nameof(targetType));
        if (string.IsNullOrWhiteSpace(targetId)) throw new ArgumentException("targetId is required.", nameof(targetId));

        var auditEvent = new AdminAuditEvent
        {
            ActorUserId = actorUserId,
            ActorRole = actorRole,
            ActionType = actionType,
            TargetType = targetType,
            TargetId = targetId,
            WorkspaceId = workspaceId,
            AccountId = accountId,
            Reason = reason,
            MetadataJson = string.IsNullOrWhiteSpace(metadataJson) ? "{}" : metadataJson,
            CreatedAt = DateTime.UtcNow
        };

        _context.AdminAuditEvents.Add(auditEvent);
        await _context.SaveChangesAsync();

        return auditEvent;
    }

    public async Task<AdminRecordAccessEvent> WriteRecordAccessEventAsync(
        string actorUserId,
        string recordType,
        string recordId,
        string reason,
        int resultCount)
    {
        if (string.IsNullOrWhiteSpace(actorUserId)) throw new ArgumentException("actorUserId is required.", nameof(actorUserId));
        if (string.IsNullOrWhiteSpace(recordType)) throw new ArgumentException("recordType is required.", nameof(recordType));
        if (string.IsNullOrWhiteSpace(recordId)) throw new ArgumentException("recordId is required.", nameof(recordId));
        if (string.IsNullOrWhiteSpace(reason)) throw new ArgumentException("reason is required.", nameof(reason));

        var recordAccessEvent = new AdminRecordAccessEvent
        {
            ActorUserId = actorUserId,
            RecordType = recordType,
            RecordId = recordId,
            Reason = reason,
            ResultCount = resultCount,
            CreatedAt = DateTime.UtcNow
        };

        _context.AdminRecordAccessEvents.Add(recordAccessEvent);
        await _context.SaveChangesAsync();

        return recordAccessEvent;
    }
}
