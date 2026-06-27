using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Wpd.Domain.Entities;
using Wpd.Infrastructure.Data;

namespace Wpd.Application.Services.Admin;

public class AdminUserService : IAdminUserService
{
    private const string UserRole = "User";
    private const string AdminRole = "Admin";
    private const string SystemAdminRole = "SystemAdmin";

    private readonly ApplicationDbContext _context;
    private readonly IAdminAuditService _adminAuditService;

    public AdminUserService(ApplicationDbContext context, IAdminAuditService adminAuditService)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(adminAuditService);

        _context = context;
        _adminAuditService = adminAuditService;
    }

    public async Task<IReadOnlyList<AdminUserSummaryDto>> GetUsersAsync(string actorUserId, string actorRole, int? workspaceId)
    {
        var actor = await _context.WpdUsers.AsNoTracking().FirstOrDefaultAsync(u => u.Id == actorUserId);
        if (actor == null)
        {
            return Array.Empty<AdminUserSummaryDto>();
        }

        var usersQuery =
            from user in _context.WpdUsers.AsNoTracking()
            join state in _context.UserAdminStates.AsNoTracking() on user.Id equals state.UserId into stateGroup
            from state in stateGroup.DefaultIfEmpty()
            select new { user, state };

        if (!string.Equals(actorRole, SystemAdminRole, StringComparison.OrdinalIgnoreCase))
        {
            usersQuery = usersQuery.Where(x => x.user.OrganizationId == actor.OrganizationId);
        }

        if (workspaceId.HasValue)
        {
            usersQuery = usersQuery.Where(x => x.user.DefaultWorkspaceId == workspaceId.Value);
        }

        return await usersQuery
            .OrderBy(x => x.user.DisplayName)
            .Select(x => new AdminUserSummaryDto
            {
                UserId = x.user.Id,
                Email = x.user.Email,
                DisplayName = x.user.DisplayName,
                WorkspaceId = x.user.DefaultWorkspaceId,
                AccountId = x.user.OrganizationId,
                IsActive = x.state == null || x.state.IsActive,
                Role = x.state != null && !string.IsNullOrWhiteSpace(x.state.AssignedRole) ? x.state.AssignedRole : UserRole
            })
            .ToListAsync();
    }

    public async Task<AdminUserDetailDto?> GetUserByIdAsync(string actorUserId, string actorRole, string targetUserId)
    {
        var users = await GetUsersAsync(actorUserId, actorRole, workspaceId: null);
        var targetSummary = users.FirstOrDefault(u => string.Equals(u.UserId, targetUserId, StringComparison.Ordinal));
        if (targetSummary == null)
        {
            return null;
        }

        var user = await _context.WpdUsers.AsNoTracking().FirstOrDefaultAsync(u => u.Id == targetUserId);
        if (user == null)
        {
            return null;
        }

        return new AdminUserDetailDto
        {
            UserId = targetSummary.UserId,
            Email = targetSummary.Email,
            DisplayName = targetSummary.DisplayName,
            WorkspaceId = targetSummary.WorkspaceId,
            AccountId = targetSummary.AccountId,
            IsActive = targetSummary.IsActive,
            Role = targetSummary.Role,
            CreatedAt = user.CreatedAt,
            LastLoginAt = user.LastLoginAt
        };
    }

    public async Task<AdminMutationResult> UpdateUserRoleAsync(string actorUserId, string actorRole, string targetUserId, string role, string? reason)
    {
        var actor = await _context.WpdUsers.FindAsync(actorUserId);
        if (actor == null)
        {
            return AdminMutationResult.Failure("ActorNotFound", "Actor user was not found.");
        }

        var target = await _context.WpdUsers.FindAsync(targetUserId);
        if (target == null)
        {
            return AdminMutationResult.Failure("TargetUserNotFound", "Target user was not found.");
        }

        if (!CanAccessTargetAccount(actorRole, actor.OrganizationId, target.OrganizationId))
        {
            return AdminMutationResult.Failure("ScopeForbidden", "Insufficient account scope.");
        }

        if (!TryNormalizeRole(role, out var normalizedRole))
        {
            return AdminMutationResult.Failure("InvalidRole", "Role must be User, Admin, or SystemAdmin.");
        }

        if (!CanAssignRole(actorRole, normalizedRole))
        {
            return AdminMutationResult.Failure("RoleForbidden", "Actor cannot assign requested role.");
        }

        var state = await _context.UserAdminStates.FindAsync(targetUserId);
        if (state == null)
        {
            state = new UserAdminState
            {
                UserId = target.Id,
                AccountId = target.OrganizationId,
                WorkspaceId = target.DefaultWorkspaceId,
                IsActive = true
            };
            _context.UserAdminStates.Add(state);
        }

        if (string.Equals(state.AssignedRole ?? UserRole, normalizedRole, StringComparison.OrdinalIgnoreCase))
        {
            return AdminMutationResult.Failure("RoleUnchanged", "User already has the requested role.");
        }

        state.AssignedRole = normalizedRole;
        await _context.SaveChangesAsync();

        var metadata = JsonSerializer.Serialize(new
        {
            state.AccountId,
            state.WorkspaceId,
            AssignedRole = state.AssignedRole
        });

        await _adminAuditService.WriteAuditEventAsync(
            actorUserId: actorUserId,
            actorRole: actorRole,
            actionType: "RoleChanged",
            targetType: "User",
            targetId: targetUserId,
            workspaceId: state.WorkspaceId,
            accountId: state.AccountId,
            reason: reason,
            metadataJson: metadata);

        return AdminMutationResult.Success();
    }

    public async Task<AdminMutationResult> DeactivateUserAsync(string actorUserId, string actorRole, string targetUserId, string? reason)
    {
        var actor = await _context.WpdUsers.FindAsync(actorUserId);
        if (actor == null)
        {
            return AdminMutationResult.Failure("ActorNotFound", "Actor user was not found.");
        }

        var target = await _context.WpdUsers.FindAsync(targetUserId);
        if (target == null)
        {
            return AdminMutationResult.Failure("TargetUserNotFound", "Target user was not found.");
        }

        if (!CanAccessTargetAccount(actorRole, actor.OrganizationId, target.OrganizationId))
        {
            return AdminMutationResult.Failure("ScopeForbidden", "Insufficient account scope.");
        }

        var state = await _context.UserAdminStates.FindAsync(targetUserId);
        if (state?.IsActive == false)
        {
            return AdminMutationResult.Failure("UserAlreadyDeactivated", "User is already deactivated.");
        }

        if (state == null)
        {
            state = new UserAdminState
            {
                UserId = target.Id,
                AccountId = target.OrganizationId,
                WorkspaceId = target.DefaultWorkspaceId,
                IsActive = true
            };
            _context.UserAdminStates.Add(state);
        }

        state.IsActive = false;
        state.DeactivatedAt = DateTime.UtcNow;
        state.DeactivatedByUserId = actorUserId;
        state.DeactivationReason = reason;

        await _context.SaveChangesAsync();

        var metadata = JsonSerializer.Serialize(new
        {
            state.AccountId,
            state.WorkspaceId,
            state.IsActive
        });

        await _adminAuditService.WriteAuditEventAsync(
            actorUserId: actorUserId,
            actorRole: actorRole,
            actionType: "UserDeactivated",
            targetType: "User",
            targetId: targetUserId,
            workspaceId: state.WorkspaceId,
            accountId: state.AccountId,
            reason: reason,
            metadataJson: metadata);

        return AdminMutationResult.Success();
    }

    public async Task<AdminMutationResult> ReactivateUserAsync(string actorUserId, string actorRole, string targetUserId, string? reason)
    {
        var actor = await _context.WpdUsers.FindAsync(actorUserId);
        if (actor == null)
        {
            return AdminMutationResult.Failure("ActorNotFound", "Actor user was not found.");
        }

        var target = await _context.WpdUsers.FindAsync(targetUserId);
        if (target == null)
        {
            return AdminMutationResult.Failure("TargetUserNotFound", "Target user was not found.");
        }

        if (!CanAccessTargetAccount(actorRole, actor.OrganizationId, target.OrganizationId))
        {
            return AdminMutationResult.Failure("ScopeForbidden", "Insufficient account scope.");
        }

        var state = await _context.UserAdminStates.FindAsync(targetUserId);
        if (state == null || state.IsActive)
        {
            return AdminMutationResult.Failure("UserAlreadyActive", "User is already active.");
        }

        state.IsActive = true;
        state.ReactivatedAt = DateTime.UtcNow;
        state.ReactivatedByUserId = actorUserId;

        await _context.SaveChangesAsync();

        var metadata = JsonSerializer.Serialize(new
        {
            state.AccountId,
            state.WorkspaceId,
            state.IsActive
        });

        await _adminAuditService.WriteAuditEventAsync(
            actorUserId: actorUserId,
            actorRole: actorRole,
            actionType: "UserReactivated",
            targetType: "User",
            targetId: targetUserId,
            workspaceId: state.WorkspaceId,
            accountId: state.AccountId,
            reason: reason,
            metadataJson: metadata);

        return AdminMutationResult.Success();
    }

    public async Task<AdminMutationResult> DeactivateAccountAsync(string actorUserId, string actorRole, int targetAccountId, string? reason)
    {
        var actor = await _context.WpdUsers.FindAsync(actorUserId);
        if (actor == null)
        {
            return AdminMutationResult.Failure("ActorNotFound", "Actor user was not found.");
        }

        if (!CanAccessTargetAccount(actorRole, actor.OrganizationId, targetAccountId))
        {
            return AdminMutationResult.Failure("ScopeForbidden", "Insufficient account scope.");
        }

        var accountState = await _context.AccountAdminStates.FindAsync(targetAccountId);
        if (accountState?.IsActive == false)
        {
            return AdminMutationResult.Failure("AccountAlreadyDeactivated", "Account is already deactivated.");
        }

        if (accountState == null)
        {
            accountState = new AccountAdminState
            {
                AccountId = targetAccountId,
                IsActive = true
            };
            _context.AccountAdminStates.Add(accountState);
        }

        accountState.IsActive = false;
        accountState.DeactivatedAt = DateTime.UtcNow;
        accountState.DeactivatedByUserId = actorUserId;
        accountState.DeactivationReason = reason;

        await _context.SaveChangesAsync();

        var metadata = JsonSerializer.Serialize(new { accountState.AccountId, accountState.IsActive });
        await _adminAuditService.WriteAuditEventAsync(
            actorUserId: actorUserId,
            actorRole: actorRole,
            actionType: "AccountDeactivated",
            targetType: "Account",
            targetId: targetAccountId.ToString(),
            workspaceId: null,
            accountId: targetAccountId,
            reason: reason,
            metadataJson: metadata);

        return AdminMutationResult.Success();
    }

    public async Task<AdminMutationResult> ReactivateAccountAsync(string actorUserId, string actorRole, int targetAccountId, string? reason)
    {
        var actor = await _context.WpdUsers.FindAsync(actorUserId);
        if (actor == null)
        {
            return AdminMutationResult.Failure("ActorNotFound", "Actor user was not found.");
        }

        if (!CanAccessTargetAccount(actorRole, actor.OrganizationId, targetAccountId))
        {
            return AdminMutationResult.Failure("ScopeForbidden", "Insufficient account scope.");
        }

        var accountState = await _context.AccountAdminStates.FindAsync(targetAccountId);
        if (accountState == null || accountState.IsActive)
        {
            return AdminMutationResult.Failure("AccountAlreadyActive", "Account is already active.");
        }

        accountState.IsActive = true;
        accountState.DeactivationReason = null;
        accountState.DeactivatedAt = null;
        accountState.DeactivatedByUserId = null;

        await _context.SaveChangesAsync();

        var metadata = JsonSerializer.Serialize(new { accountState.AccountId, accountState.IsActive });
        await _adminAuditService.WriteAuditEventAsync(
            actorUserId: actorUserId,
            actorRole: actorRole,
            actionType: "AccountReactivated",
            targetType: "Account",
            targetId: targetAccountId.ToString(),
            workspaceId: null,
            accountId: targetAccountId,
            reason: reason,
            metadataJson: metadata);

        return AdminMutationResult.Success();
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

    private static bool CanAccessTargetAccount(string actorRole, int? actorAccountId, int targetAccountId)
    {
        if (string.Equals(actorRole, SystemAdminRole, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (!string.Equals(actorRole, AdminRole, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        return actorAccountId.HasValue && actorAccountId.Value == targetAccountId;
    }

    private static bool TryNormalizeRole(string role, out string normalizedRole)
    {
        if (string.Equals(role, UserRole, StringComparison.OrdinalIgnoreCase))
        {
            normalizedRole = UserRole;
            return true;
        }

        if (string.Equals(role, AdminRole, StringComparison.OrdinalIgnoreCase))
        {
            normalizedRole = AdminRole;
            return true;
        }

        if (string.Equals(role, SystemAdminRole, StringComparison.OrdinalIgnoreCase))
        {
            normalizedRole = SystemAdminRole;
            return true;
        }

        normalizedRole = string.Empty;
        return false;
    }

    private static bool CanAssignRole(string actorRole, string targetRole)
    {
        if (string.Equals(actorRole, SystemAdminRole, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (!string.Equals(actorRole, AdminRole, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        return !string.Equals(targetRole, SystemAdminRole, StringComparison.OrdinalIgnoreCase);
    }
}
