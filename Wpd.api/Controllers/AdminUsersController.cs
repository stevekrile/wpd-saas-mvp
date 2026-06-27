using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Wpd.Api.DTOs.Admin;
using Wpd.Api.Security;
using Wpd.Application.Services.Admin;

namespace Wpd.Api.Controllers;

[ApiController]
[Route("api/admin/users")]
[Authorize(Policy = AdminAuthorizationPolicies.AdminPolicy)]
public class AdminUsersController : ControllerBase
{
    private readonly IAdminUserService _adminUserService;

    public AdminUsersController(IAdminUserService adminUserService)
    {
        _adminUserService = adminUserService;
    }

    [HttpGet]
    public async Task<IActionResult> GetUsers([FromQuery] int? workspaceId = null)
    {
        var actorUserId = GetUserId();
        if (string.IsNullOrWhiteSpace(actorUserId))
        {
            return Unauthorized();
        }

        var actorRole = GetActorRole();
        var users = await _adminUserService.GetUsersAsync(actorUserId, actorRole, workspaceId);
        return Ok(users);
    }

    [HttpGet("{userId}")]
    public async Task<IActionResult> GetUserById(string userId)
    {
        var actorUserId = GetUserId();
        if (string.IsNullOrWhiteSpace(actorUserId))
        {
            return Unauthorized();
        }

        var actorRole = GetActorRole();
        var user = await _adminUserService.GetUserByIdAsync(actorUserId, actorRole, userId);
        if (user == null)
        {
            return NotFound(new
            {
                requestId = HttpContext.TraceIdentifier,
                errorCode = "TargetUserNotFound",
                message = "Target user was not found."
            });
        }

        return Ok(user);
    }

    [HttpPatch("{userId}/role")]
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

        var actorRole = GetActorRole();
        var result = await _adminUserService.UpdateUserRoleAsync(actorUserId, actorRole, userId, request.Role, request.Reason);
        return ToMutationResponse(result, userId);
    }

    [HttpPost("{userId}/deactivate")]
    public async Task<IActionResult> DeactivateUser(string userId, [FromBody] AdminActionRequest? request)
    {
        var actorUserId = GetUserId();
        if (string.IsNullOrWhiteSpace(actorUserId))
        {
            return Unauthorized();
        }

        var actorRole = GetActorRole();
        var result = await _adminUserService.DeactivateUserAsync(actorUserId, actorRole, userId, request?.Reason);
        return ToMutationResponse(result, userId);
    }

    [HttpPost("{userId}/reactivate")]
    public async Task<IActionResult> ReactivateUser(string userId, [FromBody] AdminActionRequest? request)
    {
        var actorUserId = GetUserId();
        if (string.IsNullOrWhiteSpace(actorUserId))
        {
            return Unauthorized();
        }

        var actorRole = GetActorRole();
        var result = await _adminUserService.ReactivateUserAsync(actorUserId, actorRole, userId, request?.Reason);
        return ToMutationResponse(result, userId);
    }

    private string GetUserId() =>
        User.FindFirst(ClaimTypes.NameIdentifier)?.Value
        ?? User.FindFirst("sub")?.Value
        ?? string.Empty;

    private string GetActorRole()
    {
        if (AdminRoleEvaluator.HasAnyRole(User, AdminRoles.SystemAdmin))
        {
            return AdminRoles.SystemAdmin;
        }

        if (AdminRoleEvaluator.HasAnyRole(User, AdminRoles.Admin))
        {
            return AdminRoles.Admin;
        }

        return string.Empty;
    }

    private IActionResult ToMutationResponse(AdminMutationResult result, string targetId)
    {
        if (result.Succeeded)
        {
            return Ok(new
            {
                requestId = HttpContext.TraceIdentifier,
                performedBy = GetUserId(),
                performedAtUtc = DateTime.UtcNow,
                targetId
            });
        }

        if (result.ErrorCode is "ScopeForbidden")
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                requestId = HttpContext.TraceIdentifier,
                errorCode = result.ErrorCode,
                message = result.Message
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
            return Conflict(new
            {
                requestId = HttpContext.TraceIdentifier,
                errorCode = result.ErrorCode,
                message = result.Message
            });
        }

        if (result.ErrorCode is "RoleUnchanged")
        {
            return Conflict(new
            {
                requestId = HttpContext.TraceIdentifier,
                errorCode = result.ErrorCode,
                message = result.Message
            });
        }

        return BadRequest(new
        {
            requestId = HttpContext.TraceIdentifier,
            errorCode = result.ErrorCode,
            message = result.Message
        });
    }
}
