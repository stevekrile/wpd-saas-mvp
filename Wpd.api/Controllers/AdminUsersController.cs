using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Wpd.Api.DTOs.Admin;
using Wpd.Application.Services.Admin;
using Wpd.Infrastructure.Data;

namespace Wpd.Api.Controllers;

[ApiController]
[Route("api/admin/users")]
[Authorize]
public class AdminUsersController : ControllerBase
{
    private readonly IAdminUserService _adminUserService;
    private readonly ApplicationDbContext _context;

    public AdminUsersController(IAdminUserService adminUserService, ApplicationDbContext context)
    {
        _adminUserService = adminUserService;
        _context = context;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<AdminUserSummaryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetUsers([FromQuery] int? workspaceId = null)
    {
        var actorUserId = GetUserId();
        if (string.IsNullOrWhiteSpace(actorUserId))
        {
            return Unauthorized();
        }

        var actorRole = await GetActorRoleAsync(actorUserId);
        if (!IsAdminRole(actorRole))
        {
            return Forbid();
        }

        var users = await _adminUserService.GetUsersAsync(actorUserId, actorRole, workspaceId);
        return Ok(users);
    }

    [HttpGet("{userId}")]
    [ProducesResponseType(typeof(AdminUserDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetUserById(string userId)
    {
        var actorUserId = GetUserId();
        if (string.IsNullOrWhiteSpace(actorUserId))
        {
            return Unauthorized();
        }

        var actorRole = await GetActorRoleAsync(actorUserId);
        if (!IsAdminRole(actorRole))
        {
            return Forbid();
        }

        var user = await _adminUserService.GetUserByIdAsync(actorUserId, actorRole, userId);
        if (user == null)
        {
            return NotFound(new AdminErrorResponseDto
            {
                RequestId = HttpContext.TraceIdentifier,
                ErrorCode = "TargetUserNotFound",
                Message = "Target user was not found."
            });
        }

        return Ok(user);
    }

    [HttpPatch("{userId}/role")]
    [ProducesResponseType(typeof(AdminMutationResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> UpdateUserRole(string userId, [FromBody] UpdateUserRoleRequest request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Role))
        {
            return BadRequest(new
            {
                requestId = HttpContext.TraceIdentifier,
                errorCode = "InvalidRole",
                message = "Role is required."
            });
        }

        var actorUserId = GetUserId();
        if (string.IsNullOrWhiteSpace(actorUserId))
        {
            return Unauthorized();
        }

        var actorRole = await GetActorRoleAsync(actorUserId);
        if (!IsAdminRole(actorRole))
        {
            return Forbid();
        }

        var result = await _adminUserService.UpdateUserRoleAsync(actorUserId, actorRole, userId, request.Role, request.Reason);
        return ToMutationResponse(result, userId);
    }

    [HttpPost("{userId}/deactivate")]
    [ProducesResponseType(typeof(AdminMutationResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> DeactivateUser(string userId, [FromBody] AdminActionRequest? request)
    {
        var actorUserId = GetUserId();
        if (string.IsNullOrWhiteSpace(actorUserId))
        {
            return Unauthorized();
        }

        var actorRole = await GetActorRoleAsync(actorUserId);
        if (!IsAdminRole(actorRole))
        {
            return Forbid();
        }

        var result = await _adminUserService.DeactivateUserAsync(actorUserId, actorRole, userId, request?.Reason);
        return ToMutationResponse(result, userId);
    }

    [HttpPost("{userId}/reactivate")]
    [ProducesResponseType(typeof(AdminMutationResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> ReactivateUser(string userId, [FromBody] AdminActionRequest? request)
    {
        var actorUserId = GetUserId();
        if (string.IsNullOrWhiteSpace(actorUserId))
        {
            return Unauthorized();
        }

        var actorRole = await GetActorRoleAsync(actorUserId);
        if (!IsAdminRole(actorRole))
        {
            return Forbid();
        }

        var result = await _adminUserService.ReactivateUserAsync(actorUserId, actorRole, userId, request?.Reason);
        return ToMutationResponse(result, userId);
    }

    private string GetUserId() =>
        User.FindFirst(ClaimTypes.NameIdentifier)?.Value
        ?? User.FindFirst("sub")?.Value
        ?? string.Empty;

    private async Task<string> GetActorRoleAsync(string userId)
    {
        var state = await _context.UserAdminStates.AsNoTracking().FirstOrDefaultAsync(s => s.UserId == userId);
        if (string.Equals(state?.AssignedRole, "SystemAdmin", StringComparison.OrdinalIgnoreCase))
        {
            return "SystemAdmin";
        }

        if (string.Equals(state?.AssignedRole, "Admin", StringComparison.OrdinalIgnoreCase))
        {
            return "Admin";
        }

        return "User";
    }

    private static bool IsAdminRole(string role) =>
        string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase)
        || string.Equals(role, "SystemAdmin", StringComparison.OrdinalIgnoreCase);

    private IActionResult ToMutationResponse(AdminMutationResult result, string targetId)
    {
        if (result.Succeeded)
        {
            return Ok(new AdminMutationResponseDto
            {
                RequestId = HttpContext.TraceIdentifier,
                PerformedBy = GetUserId(),
                PerformedAtUtc = DateTime.UtcNow,
                TargetId = targetId
            });
        }

        if (result.ErrorCode is "ScopeForbidden")
        {
            return StatusCode(StatusCodes.Status403Forbidden, new AdminErrorResponseDto
            {
                RequestId = HttpContext.TraceIdentifier,
                ErrorCode = result.ErrorCode ?? string.Empty,
                Message = result.Message ?? string.Empty
            });
        }

        if (result.ErrorCode is "TargetUserNotFound")
        {
            return NotFound(new
            {
                requestId = HttpContext.TraceIdentifier,
                errorCode = result.ErrorCode,
                message = result.Message
            });
        }

        if (result.ErrorCode is "UserAlreadyDeactivated" or "UserAlreadyActive")
        {
            return Conflict(new AdminErrorResponseDto
            {
                RequestId = HttpContext.TraceIdentifier,
                ErrorCode = result.ErrorCode ?? string.Empty,
                Message = result.Message ?? string.Empty
            });
        }

        if (result.ErrorCode is "RoleUnchanged")
        {
            return Conflict(new AdminErrorResponseDto
            {
                RequestId = HttpContext.TraceIdentifier,
                ErrorCode = result.ErrorCode ?? string.Empty,
                Message = result.Message ?? string.Empty
            });
        }

        return BadRequest(new AdminErrorResponseDto
        {
            RequestId = HttpContext.TraceIdentifier,
            ErrorCode = result.ErrorCode ?? string.Empty,
            Message = result.Message ?? string.Empty
        });
    }
}

