using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Wpd.Domain.Entities;
using Wpd.Infrastructure.Data;

namespace Wpd.Application.Services.Admin;

public class AdminRecordAccessService : IAdminRecordAccessService
{
    private const string AdminRole = "Admin";
    private const string SystemAdminRole = "SystemAdmin";

    private readonly ApplicationDbContext _context;
    private readonly IAdminAuditService _adminAuditService;

    public AdminRecordAccessService(ApplicationDbContext context, IAdminAuditService adminAuditService)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(adminAuditService);

        _context = context;
        _adminAuditService = adminAuditService;
    }

    public async Task<AdminQueryResult<AdminRecordAccessResultDto>> QueryRecordAsync(
        string actorUserId,
        string actorRole,
        string recordType,
        string recordId,
        string reason)
    {
        if (string.IsNullOrWhiteSpace(reason))
        {
            return AdminQueryResult<AdminRecordAccessResultDto>.Failure("ReasonRequired", "Reason is required.");
        }

        var actor = await LoadActorAsync(actorUserId);
        if (actor == null)
        {
            return AdminQueryResult<AdminRecordAccessResultDto>.Failure("ActorNotFound", "Actor user was not found.");
        }

        var normalizedRecordType = NormalizeRecordType(recordType);
        if (normalizedRecordType == null)
        {
            return AdminQueryResult<AdminRecordAccessResultDto>.Failure("UnsupportedRecordType", $"Unsupported record type '{recordType}'.");
        }

        var queryResult = await LoadRecordAsync(actorRole, actor, normalizedRecordType, recordId);
        if (!queryResult.Succeeded)
        {
            if (string.Equals(queryResult.ErrorCode, "TargetRecordNotFound", StringComparison.OrdinalIgnoreCase))
            {
                await _adminAuditService.WriteRecordAccessEventAsync(
                    actorUserId: actorUserId,
                    recordType: normalizedRecordType,
                    recordId: recordId,
                    reason: reason,
                    resultCount: 0);

                await _adminAuditService.WriteAuditEventAsync(
                    actorUserId: actorUserId,
                    actorRole: actorRole,
                    actionType: "RecordAccessed",
                    targetType: normalizedRecordType,
                    targetId: recordId,
                    workspaceId: null,
                    accountId: null,
                    reason: reason,
                    metadataJson: JsonSerializer.Serialize(new
                    {
                        recordType = normalizedRecordType,
                        recordId,
                        resultCount = 0,
                        found = false
                    }));
            }

            return AdminQueryResult<AdminRecordAccessResultDto>.Failure(queryResult.ErrorCode!, queryResult.Message!);
        }

        var payload = queryResult.Payload;
        var resultCount = payload.Count == 0 ? 0 : 1;

        await _adminAuditService.WriteRecordAccessEventAsync(
            actorUserId: actorUserId,
            recordType: normalizedRecordType,
            recordId: recordId,
            reason: reason,
            resultCount: resultCount);

        await _adminAuditService.WriteAuditEventAsync(
            actorUserId: actorUserId,
            actorRole: actorRole,
            actionType: "RecordAccessed",
            targetType: normalizedRecordType,
            targetId: recordId,
            workspaceId: queryResult.WorkspaceId,
            accountId: queryResult.AccountId,
            reason: reason,
            metadataJson: JsonSerializer.Serialize(new
            {
                recordType = normalizedRecordType,
                recordId,
                resultCount
            }));

        return AdminQueryResult<AdminRecordAccessResultDto>.Success(new AdminRecordAccessResultDto
        {
            RecordType = normalizedRecordType,
            RecordId = recordId,
            ResultCount = resultCount,
            Data = payload
        });
    }

    public async Task<AdminQueryResult<IReadOnlyList<AdminRecordAccessHistoryDto>>> GetHistoryAsync(
        string actorUserId,
        string actorRole,
        DateTime fromUtc,
        DateTime toUtc,
        string? actorFilterUserId)
    {
        if (fromUtc > toUtc)
        {
            return AdminQueryResult<IReadOnlyList<AdminRecordAccessHistoryDto>>.Failure("InvalidDateRange", "fromUtc must be <= toUtc.");
        }

        var actor = await LoadActorAsync(actorUserId);
        if (actor == null)
        {
            return AdminQueryResult<IReadOnlyList<AdminRecordAccessHistoryDto>>.Failure("ActorNotFound", "Actor user was not found.");
        }

        var query = _context.AdminRecordAccessEvents.AsNoTracking()
            .Where(e => e.CreatedAt >= fromUtc && e.CreatedAt <= toUtc);

        if (!string.IsNullOrWhiteSpace(actorFilterUserId))
        {
            query = query.Where(e => e.ActorUserId == actorFilterUserId);
        }

        if (!string.Equals(actorRole, SystemAdminRole, StringComparison.OrdinalIgnoreCase))
        {
            if (!string.Equals(actorRole, AdminRole, StringComparison.OrdinalIgnoreCase))
            {
                return AdminQueryResult<IReadOnlyList<AdminRecordAccessHistoryDto>>.Failure("ScopeForbidden", "Insufficient account scope.");
            }

            if (actor.OrganizationId.HasValue)
            {
                var actorUserIdsInScope = _context.WpdUsers.AsNoTracking()
                    .Where(u => u.OrganizationId == actor.OrganizationId.Value)
                    .Select(u => u.Id);

                query = query.Where(e => actorUserIdsInScope.Contains(e.ActorUserId));
            }
        }

        var history = await query
            .OrderByDescending(e => e.CreatedAt)
            .Select(e => new AdminRecordAccessHistoryDto
            {
                Id = e.Id,
                ActorUserId = e.ActorUserId,
                RecordType = e.RecordType,
                RecordId = e.RecordId,
                Reason = e.Reason,
                ResultCount = e.ResultCount,
                CreatedAt = e.CreatedAt
            })
            .ToListAsync();

        return AdminQueryResult<IReadOnlyList<AdminRecordAccessHistoryDto>>.Success(history);
    }

    private async Task<WpdUser?> LoadActorAsync(string actorUserId)
    {
        return await _context.WpdUsers.AsNoTracking().FirstOrDefaultAsync(u => u.Id == actorUserId);
    }

    private async Task<(bool Succeeded, string? ErrorCode, string? Message, Dictionary<string, object?> Payload, int? AccountId, int? WorkspaceId)> LoadRecordAsync(
        string actorRole,
        WpdUser actor,
        string recordType,
        string recordId)
    {
        switch (recordType)
        {
            case "user":
                return await LoadUserAsync(actorRole, actor, recordId);
            case "workspace":
                return await LoadWorkspaceAsync(actorRole, actor, recordId);
            case "process":
                return await LoadProcessAsync(actorRole, actor, recordId);
            case "diagnostic":
                return await LoadDiagnosticAsync(actorRole, actor, recordId);
            case "organization":
                return await LoadOrganizationAsync(actorRole, actor, recordId);
            default:
                return (false, "UnsupportedRecordType", $"Unsupported record type '{recordType}'.", new Dictionary<string, object?>(), null, null);
        }
    }

    private async Task<(bool Succeeded, string? ErrorCode, string? Message, Dictionary<string, object?> Payload, int? AccountId, int? WorkspaceId)> LoadUserAsync(
        string actorRole,
        WpdUser actor,
        string recordId)
    {
        var user = await _context.WpdUsers.AsNoTracking().FirstOrDefaultAsync(u => u.Id == recordId);
        if (user == null)
        {
            return NotFound();
        }

        if (!CanAccessAccount(actorRole, actor.OrganizationId, user.OrganizationId))
        {
            return Forbidden();
        }

        var state = await _context.UserAdminStates.AsNoTracking().FirstOrDefaultAsync(s => s.UserId == user.Id);
        var payload = new Dictionary<string, object?>
        {
            ["userId"] = user.Id,
            ["email"] = user.Email,
            ["displayName"] = user.DisplayName,
            ["createdAt"] = user.CreatedAt,
            ["lastLoginAt"] = user.LastLoginAt,
            ["accountId"] = user.OrganizationId,
            ["workspaceId"] = user.DefaultWorkspaceId,
            ["isActive"] = state?.IsActive ?? true,
            ["role"] = state?.AssignedRole ?? "User"
        };

        return (true, null, null, payload, user.OrganizationId, user.DefaultWorkspaceId);
    }

    private async Task<(bool Succeeded, string? ErrorCode, string? Message, Dictionary<string, object?> Payload, int? AccountId, int? WorkspaceId)> LoadWorkspaceAsync(
        string actorRole,
        WpdUser actor,
        string recordId)
    {
        if (!int.TryParse(recordId, out var workspaceId))
        {
            return InvalidRecordId();
        }

        var workspace = await _context.Workspaces.AsNoTracking().FirstOrDefaultAsync(w => w.Id == workspaceId);
        if (workspace == null)
        {
            return NotFound();
        }

        if (!CanAccessAccount(actorRole, actor.OrganizationId, workspace.OrganizationId))
        {
            return Forbidden();
        }

        var payload = new Dictionary<string, object?>
        {
            ["workspaceId"] = workspace.Id,
            ["name"] = workspace.Name,
            ["ownerUserId"] = workspace.OwnerUserId,
            ["accountId"] = workspace.OrganizationId,
            ["workspaceType"] = workspace.WorkspaceType.ToString(),
            ["createdAt"] = workspace.CreatedAt,
            ["isActive"] = workspace.IsActive
        };

        return (true, null, null, payload, workspace.OrganizationId, workspace.Id);
    }

    private async Task<(bool Succeeded, string? ErrorCode, string? Message, Dictionary<string, object?> Payload, int? AccountId, int? WorkspaceId)> LoadProcessAsync(
        string actorRole,
        WpdUser actor,
        string recordId)
    {
        if (!int.TryParse(recordId, out var processId))
        {
            return InvalidRecordId();
        }

        var process = await _context.Processes.AsNoTracking().FirstOrDefaultAsync(p => p.Id == processId);
        if (process == null)
        {
            return NotFound();
        }

        var workspace = await _context.Workspaces.AsNoTracking().FirstOrDefaultAsync(w => w.Id == process.WorkspaceId);
        if (workspace == null)
        {
            return NotFound();
        }

        if (!CanAccessAccount(actorRole, actor.OrganizationId, workspace.OrganizationId))
        {
            return Forbidden();
        }

        var payload = new Dictionary<string, object?>
        {
            ["processId"] = process.Id,
            ["workspaceId"] = process.WorkspaceId,
            ["name"] = process.Name,
            ["description"] = process.Description,
            ["problemStatement"] = process.ProblemStatement,
            ["context"] = process.Context,
            ["status"] = process.Status.ToString(),
            ["createdAt"] = process.CreatedAt,
            ["updatedAt"] = process.UpdatedAt
        };

        return (true, null, null, payload, workspace.OrganizationId, process!.WorkspaceId);
    }

    private async Task<(bool Succeeded, string? ErrorCode, string? Message, Dictionary<string, object?> Payload, int? AccountId, int? WorkspaceId)> LoadDiagnosticAsync(
        string actorRole,
        WpdUser actor,
        string recordId)
    {
        if (!int.TryParse(recordId, out var diagnosticId))
        {
            return InvalidRecordId();
        }

        var diagnostic = await _context.Diagnostics.AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == diagnosticId);

        if (diagnostic == null)
        {
            return NotFound();
        }

        var process = await _context.Processes.AsNoTracking().FirstOrDefaultAsync(p => p.Id == diagnostic.ProcessId);
        var workspace = process == null
            ? null
            : await _context.Workspaces.AsNoTracking().FirstOrDefaultAsync(w => w.Id == process.WorkspaceId);

        if (workspace == null)
        {
            return NotFound();
        }

        if (!CanAccessAccount(actorRole, actor.OrganizationId, workspace.OrganizationId))
        {
            return Forbidden();
        }

        var payload = new Dictionary<string, object?>
        {
            ["diagnosticId"] = diagnostic.Id,
            ["processId"] = diagnostic.ProcessId,
            ["userId"] = diagnostic.UserId,
            ["status"] = diagnostic.Status.ToString(),
            ["createdAt"] = diagnostic.CreatedAt,
            ["submittedAt"] = diagnostic.SubmittedAt,
            ["overallSummary"] = diagnostic.OverallSummary,
            ["primaryLensId"] = diagnostic.PrimaryLensId,
            ["questionCount"] = await _context.DiagnosticResponses.CountAsync(r => r.DiagnosticId == diagnostic.Id),
            ["lensNoteCount"] = await _context.DiagnosticLensNotes.CountAsync(n => n.DiagnosticId == diagnostic.Id)
        };

        var accountId = workspace.OrganizationId;
        var workspaceRefId = process!.WorkspaceId;
        return (true, null, null, payload, accountId, workspaceRefId);
    }

    private async Task<(bool Succeeded, string? ErrorCode, string? Message, Dictionary<string, object?> Payload, int? AccountId, int? WorkspaceId)> LoadOrganizationAsync(
        string actorRole,
        WpdUser actor,
        string recordId)
    {
        if (!int.TryParse(recordId, out var organizationId))
        {
            return InvalidRecordId();
        }

        var organization = await _context.Organizations.AsNoTracking().FirstOrDefaultAsync(o => o.Id == organizationId);
        if (organization == null)
        {
            return NotFound();
        }

        if (!CanAccessAccount(actorRole, actor.OrganizationId, organization.Id))
        {
            return Forbidden();
        }

        var payload = new Dictionary<string, object?>
        {
            ["organizationId"] = organization.Id,
            ["name"] = organization.Name,
            ["slug"] = organization.Slug,
            ["createdAt"] = organization.CreatedAt,
            ["isActive"] = organization.IsActive
        };

        return (true, null, null, payload, organization.Id, null);
    }

    private static bool CanAccessAccount(string actorRole, int? actorAccountId, int? targetAccountId)
    {
        if (string.Equals(actorRole, SystemAdminRole, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (!string.Equals(actorRole, AdminRole, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        return actorAccountId.HasValue && targetAccountId.HasValue && actorAccountId.Value == targetAccountId.Value;
    }

    private static string? NormalizeRecordType(string recordType)
    {
        if (string.IsNullOrWhiteSpace(recordType))
        {
            return null;
        }

        return recordType.Trim().ToLowerInvariant() switch
        {
            "user" or "users" => "user",
            "workspace" or "workspaces" => "workspace",
            "process" or "processes" => "process",
            "diagnostic" or "diagnostics" => "diagnostic",
            "organization" or "account" or "accounts" => "organization",
            _ => null
        };
    }

    private static (bool Succeeded, string? ErrorCode, string? Message, Dictionary<string, object?> Payload, int? AccountId, int? WorkspaceId) NotFound()
        => (false, "TargetRecordNotFound", "Target record was not found.", new Dictionary<string, object?>(), null, null);

    private static (bool Succeeded, string? ErrorCode, string? Message, Dictionary<string, object?> Payload, int? AccountId, int? WorkspaceId) Forbidden()
        => (false, "ScopeForbidden", "Insufficient account scope.", new Dictionary<string, object?>(), null, null);

    private static (bool Succeeded, string? ErrorCode, string? Message, Dictionary<string, object?> Payload, int? AccountId, int? WorkspaceId) InvalidRecordId()
        => (false, "InvalidRecordId", "recordId is invalid for the requested record type.", new Dictionary<string, object?>(), null, null);
}
