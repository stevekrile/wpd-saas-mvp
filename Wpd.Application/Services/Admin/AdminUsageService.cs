using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Wpd.Infrastructure.Data;

namespace Wpd.Application.Services.Admin;

public class AdminUsageService : IAdminUsageService
{
    private const string AdminRole = "Admin";
    private const string SystemAdminRole = "SystemAdmin";

    private readonly ApplicationDbContext _context;

    public AdminUsageService(ApplicationDbContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        _context = context;
    }

    public async Task<AdminQueryResult<AdminUsageSummaryDto>> GetUsageSummaryAsync(
        string actorUserId,
        string actorRole,
        DateTime fromUtc,
        DateTime toUtc,
        int? workspaceId)
    {
        if (fromUtc > toUtc)
        {
            return AdminQueryResult<AdminUsageSummaryDto>.Failure("InvalidDateRange", "fromUtc must be <= toUtc.");
        }

        var scopeResult = await BuildScopeAsync(actorUserId, actorRole, workspaceId);
        if (!scopeResult.Succeeded)
        {
            return AdminQueryResult<AdminUsageSummaryDto>.Failure(scopeResult.ErrorCode!, scopeResult.Message!);
        }

        var accountId = scopeResult.AccountId;
        var userIdsQuery = BuildScopedUsersQuery(scopeResult).Select(u => u.Id);
        var processScopeQuery = BuildScopedProcessesQuery(scopeResult);
        var processIdsQuery = processScopeQuery.Select(p => p.Id);

        var processesCreated = await processScopeQuery.CountAsync(p => p.CreatedAt >= fromUtc && p.CreatedAt <= toUtc);
        var diagnosticsCreated = await _context.Diagnostics.CountAsync(d =>
            processIdsQuery.Contains(d.ProcessId) && d.CreatedAt >= fromUtc && d.CreatedAt <= toUtc);
        var diagnosticResponsesSaved = await _context.DiagnosticResponses.CountAsync(r =>
            _context.Diagnostics.Any(d => d.Id == r.DiagnosticId && processIdsQuery.Contains(d.ProcessId)) &&
            r.UpdatedAt >= fromUtc && r.UpdatedAt <= toUtc);
        var upgradeEvents = await _context.UpgradeEvents.CountAsync(e =>
            userIdsQuery.Contains(e.UserId) && e.CreatedAt >= fromUtc && e.CreatedAt <= toUtc);
        var usersInScope = await BuildScopedUsersQuery(scopeResult).CountAsync();

        var aiMetrics = await GetAiUsageMetricsAsync(scopeResult, fromUtc, toUtc, actorUserId: null);

        return AdminQueryResult<AdminUsageSummaryDto>.Success(new AdminUsageSummaryDto
        {
            FromUtc = fromUtc,
            ToUtc = toUtc,
            WorkspaceId = scopeResult.WorkspaceId,
            AccountId = accountId,
            UsersInScope = usersInScope,
            ProcessesCreated = processesCreated,
            DiagnosticsCreated = diagnosticsCreated,
            DiagnosticResponsesSaved = diagnosticResponsesSaved,
            UpgradeEvents = upgradeEvents,
            AiRequestCount = aiMetrics.RequestCount,
            AiInputTokenCount = aiMetrics.InputTokenCount,
            AiOutputTokenCount = aiMetrics.OutputTokenCount,
            AiTotalTokenCount = aiMetrics.TotalTokenCount
        });
    }

    public async Task<AdminQueryResult<AdminUserUsageDto>> GetUserUsageAsync(
        string actorUserId,
        string actorRole,
        string targetUserId,
        DateTime fromUtc,
        DateTime toUtc)
    {
        if (fromUtc > toUtc)
        {
            return AdminQueryResult<AdminUserUsageDto>.Failure("InvalidDateRange", "fromUtc must be <= toUtc.");
        }

        var actor = await _context.WpdUsers.AsNoTracking().FirstOrDefaultAsync(u => u.Id == actorUserId);
        if (actor == null)
        {
            return AdminQueryResult<AdminUserUsageDto>.Failure("ActorNotFound", "Actor user was not found.");
        }

        var target = await _context.WpdUsers.AsNoTracking().FirstOrDefaultAsync(u => u.Id == targetUserId);
        if (target == null)
        {
            return AdminQueryResult<AdminUserUsageDto>.Failure("TargetUserNotFound", "Target user was not found.");
        }

        if (!CanAccessTargetAccount(actorRole, actor.OrganizationId, target.OrganizationId))
        {
            return AdminQueryResult<AdminUserUsageDto>.Failure("ScopeForbidden", "Insufficient account scope.");
        }

        var processesCreated = await _context.Processes.CountAsync(p =>
            p.OwnerUserId == targetUserId && p.CreatedAt >= fromUtc && p.CreatedAt <= toUtc);
        var diagnosticsCreated = await _context.Diagnostics.CountAsync(d =>
            d.UserId == targetUserId && d.CreatedAt >= fromUtc && d.CreatedAt <= toUtc);
        var diagnosticResponsesSaved = await _context.DiagnosticResponses.CountAsync(r =>
            _context.Diagnostics.Any(d => d.Id == r.DiagnosticId && d.UserId == targetUserId) &&
            r.UpdatedAt >= fromUtc && r.UpdatedAt <= toUtc);
        var upgradeEvents = await _context.UpgradeEvents.CountAsync(e =>
            e.UserId == targetUserId && e.CreatedAt >= fromUtc && e.CreatedAt <= toUtc);

        var aiMetrics = await GetAiUsageMetricsAsync(
            ScopeResult.Success(new ScopeContext
            {
                ActorRole = actorRole,
                AccountId = target.OrganizationId,
                WorkspaceId = target.DefaultWorkspaceId
            }),
            fromUtc,
            toUtc,
            actorUserId: targetUserId);

        return AdminQueryResult<AdminUserUsageDto>.Success(new AdminUserUsageDto
        {
            UserId = targetUserId,
            FromUtc = fromUtc,
            ToUtc = toUtc,
            ProcessesCreated = processesCreated,
            DiagnosticsCreated = diagnosticsCreated,
            DiagnosticResponsesSaved = diagnosticResponsesSaved,
            UpgradeEvents = upgradeEvents,
            AiRequestCount = aiMetrics.RequestCount,
            AiInputTokenCount = aiMetrics.InputTokenCount,
            AiOutputTokenCount = aiMetrics.OutputTokenCount,
            AiTotalTokenCount = aiMetrics.TotalTokenCount
        });
    }

    public async Task<AdminQueryResult<IReadOnlyList<AdminAiTokenUsageRowDto>>> GetAiTokenUsageAsync(
        string actorUserId,
        string actorRole,
        DateTime fromUtc,
        DateTime toUtc,
        int? workspaceId)
    {
        if (fromUtc > toUtc)
        {
            return AdminQueryResult<IReadOnlyList<AdminAiTokenUsageRowDto>>.Failure("InvalidDateRange", "fromUtc must be <= toUtc.");
        }

        var scopeResult = await BuildScopeAsync(actorUserId, actorRole, workspaceId);
        if (!scopeResult.Succeeded)
        {
            return AdminQueryResult<IReadOnlyList<AdminAiTokenUsageRowDto>>.Failure(scopeResult.ErrorCode!, scopeResult.Message!);
        }

        var aiEventsQuery = BuildScopedAiAuditEventsQuery(scopeResult, fromUtc, toUtc, actorUserId: null);
        var aiEvents = await aiEventsQuery
            .Select(e => new { e.MetadataJson })
            .ToListAsync();

        var grouped = aiEvents
            .Select(e => ParseTokenMetadata(e.MetadataJson))
            .Where(m => m != null)
            .GroupBy(m => new { m!.Provider, m.Model })
            .Select(g => new AdminAiTokenUsageRowDto
            {
                Provider = g.Key.Provider,
                Model = g.Key.Model,
                RequestCount = g.Count(),
                InputTokenCount = g.Sum(x => x!.InputTokenCount),
                OutputTokenCount = g.Sum(x => x!.OutputTokenCount),
                TotalTokenCount = g.Sum(x => x!.TotalTokenCount),
                EstimatedUsageCount = g.Count(x => x!.IsEstimated)
            })
            .OrderByDescending(x => x.TotalTokenCount)
            .ToList();

        return AdminQueryResult<IReadOnlyList<AdminAiTokenUsageRowDto>>.Success(grouped);
    }

    private async Task<ScopeResult> BuildScopeAsync(string actorUserId, string actorRole, int? workspaceId)
    {
        var actor = await _context.WpdUsers.AsNoTracking().FirstOrDefaultAsync(u => u.Id == actorUserId);
        if (actor == null)
        {
            return ScopeResult.Failure("ActorNotFound", "Actor user was not found.");
        }

        if (workspaceId.HasValue)
        {
            var workspace = await _context.Workspaces.AsNoTracking().FirstOrDefaultAsync(w => w.Id == workspaceId.Value);
            if (workspace == null)
            {
                return ScopeResult.Failure("WorkspaceNotFound", "Workspace was not found.");
            }

            if (!CanAccessTargetAccount(actorRole, actor.OrganizationId, workspace.OrganizationId))
            {
                return ScopeResult.Failure("ScopeForbidden", "Insufficient workspace scope.");
            }

            return ScopeResult.Success(new ScopeContext
            {
                ActorRole = actorRole,
                AccountId = workspace.OrganizationId,
                WorkspaceId = workspaceId.Value
            });
        }

        if (string.Equals(actorRole, SystemAdminRole, StringComparison.OrdinalIgnoreCase))
        {
            return ScopeResult.Success(new ScopeContext { ActorRole = actorRole });
        }

        if (!string.Equals(actorRole, AdminRole, StringComparison.OrdinalIgnoreCase))
        {
            return ScopeResult.Failure("ScopeForbidden", "Insufficient account scope.");
        }

        return ScopeResult.Success(new ScopeContext
        {
            ActorRole = actorRole,
            AccountId = actor.OrganizationId
        });
    }

    private IQueryable<Wpd.Domain.Entities.WpdUser> BuildScopedUsersQuery(ScopeResult scope)
    {
        var query = _context.WpdUsers.AsNoTracking().AsQueryable();
        if (scope.AccountId.HasValue)
        {
            query = query.Where(u => u.OrganizationId == scope.AccountId.Value);
        }

        if (scope.WorkspaceId.HasValue)
        {
            query = query.Where(u => u.DefaultWorkspaceId == scope.WorkspaceId.Value);
        }

        return query;
    }

    private IQueryable<Wpd.Domain.Entities.Process> BuildScopedProcessesQuery(ScopeResult scope)
    {
        var query = _context.Processes.AsNoTracking().AsQueryable();
        if (scope.WorkspaceId.HasValue)
        {
            query = query.Where(p => p.WorkspaceId == scope.WorkspaceId.Value);
            return query;
        }

        if (scope.AccountId.HasValue)
        {
            query = query.Where(p => _context.Workspaces.Any(w => w.Id == p.WorkspaceId && w.OrganizationId == scope.AccountId.Value));
        }

        return query;
    }

    private IQueryable<Wpd.Domain.Entities.AdminAuditEvent> BuildScopedAiAuditEventsQuery(
        ScopeResult scope,
        DateTime fromUtc,
        DateTime toUtc,
        string? actorUserId)
    {
        var query = _context.AdminAuditEvents.AsNoTracking()
            .Where(e => e.CreatedAt >= fromUtc && e.CreatedAt <= toUtc)
            .Where(e => e.TargetType == "AiRecommendation" || EF.Functions.Like(e.ActionType, "%Ai%"));

        if (!string.IsNullOrWhiteSpace(actorUserId))
        {
            query = query.Where(e => e.ActorUserId == actorUserId);
        }

        if (scope.WorkspaceId.HasValue)
        {
            query = query.Where(e => e.WorkspaceId == scope.WorkspaceId.Value);
        }
        else if (scope.AccountId.HasValue)
        {
            query = query.Where(e => e.AccountId == scope.AccountId.Value);
        }

        return query;
    }

    private async Task<(int RequestCount, int InputTokenCount, int OutputTokenCount, int TotalTokenCount)> GetAiUsageMetricsAsync(
        ScopeResult scope,
        DateTime fromUtc,
        DateTime toUtc,
        string? actorUserId)
    {
        var aiEvents = await BuildScopedAiAuditEventsQuery(scope, fromUtc, toUtc, actorUserId)
            .Select(e => new { e.MetadataJson })
            .ToListAsync();

        var parsed = aiEvents.Select(e => ParseTokenMetadata(e.MetadataJson)).Where(p => p != null).ToList();
        return (
            RequestCount: parsed.Count,
            InputTokenCount: parsed.Sum(p => p!.InputTokenCount),
            OutputTokenCount: parsed.Sum(p => p!.OutputTokenCount),
            TotalTokenCount: parsed.Sum(p => p!.TotalTokenCount));
    }

    private static ParsedTokenMetadata? ParseTokenMetadata(string metadataJson)
    {
        if (string.IsNullOrWhiteSpace(metadataJson))
        {
            return null;
        }

        using var document = JsonDocument.Parse(metadataJson);
        var root = document.RootElement;

        var input = GetInt(root, "inputTokenCount", "InputTokenCount");
        var output = GetInt(root, "outputTokenCount", "OutputTokenCount");
        var total = GetInt(root, "totalTokenCount", "TotalTokenCount");

        if (input == 0 && output == 0 && total == 0)
        {
            return null;
        }

        if (total == 0)
        {
            total = input + output;
        }

        return new ParsedTokenMetadata
        {
            Provider = GetString(root, "provider", "Provider", "providerName", "ProviderName") ?? "unknown",
            Model = GetString(root, "model", "Model", "modelName", "ModelName") ?? "unknown",
            InputTokenCount = input,
            OutputTokenCount = output,
            TotalTokenCount = total,
            IsEstimated = GetBool(root, "tokenUsageIsEstimated", "TokenUsageIsEstimated", "isEstimated", "IsEstimated")
        };
    }

    private static int GetInt(JsonElement root, params string[] names)
    {
        foreach (var name in names)
        {
            if (root.TryGetProperty(name, out var value))
            {
                if (value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var intValue))
                {
                    return intValue;
                }

                if (value.ValueKind == JsonValueKind.String && int.TryParse(value.GetString(), out intValue))
                {
                    return intValue;
                }
            }
        }

        return 0;
    }

    private static string? GetString(JsonElement root, params string[] names)
    {
        foreach (var name in names)
        {
            if (root.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String)
            {
                var stringValue = value.GetString();
                if (!string.IsNullOrWhiteSpace(stringValue))
                {
                    return stringValue;
                }
            }
        }

        return null;
    }

    private static bool GetBool(JsonElement root, params string[] names)
    {
        foreach (var name in names)
        {
            if (root.TryGetProperty(name, out var value))
            {
                if (value.ValueKind == JsonValueKind.True) return true;
                if (value.ValueKind == JsonValueKind.False) return false;
                if (value.ValueKind == JsonValueKind.String && bool.TryParse(value.GetString(), out var boolValue)) return boolValue;
            }
        }

        return false;
    }

    private static bool CanAccessTargetAccount(string actorRole, int? actorAccountId, int? targetAccountId)
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

    private class ScopeContext
    {
        public string ActorRole { get; init; } = string.Empty;
        public int? AccountId { get; init; }
        public int? WorkspaceId { get; init; }
    }

    private class ScopeResult
    {
        public bool Succeeded { get; init; }
        public string? ErrorCode { get; init; }
        public string? Message { get; init; }
        public string ActorRole { get; init; } = string.Empty;
        public int? AccountId { get; init; }
        public int? WorkspaceId { get; init; }

        public static ScopeResult Success(ScopeContext scope) => new()
        {
            Succeeded = true,
            ActorRole = scope.ActorRole,
            AccountId = scope.AccountId,
            WorkspaceId = scope.WorkspaceId
        };

        public static ScopeResult Failure(string errorCode, string message) => new()
        {
            Succeeded = false,
            ErrorCode = errorCode,
            Message = message
        };
    }

    private class ParsedTokenMetadata
    {
        public string Provider { get; init; } = "unknown";
        public string Model { get; init; } = "unknown";
        public int InputTokenCount { get; init; }
        public int OutputTokenCount { get; init; }
        public int TotalTokenCount { get; init; }
        public bool IsEstimated { get; init; }
    }
}
