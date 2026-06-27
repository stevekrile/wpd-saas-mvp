using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Wpd.Api.DTOs.Admin;
using Wpd.Api.Security;
using Wpd.Application.Services.Admin;

namespace Wpd.Api.Controllers;

[ApiController]
[Route("api/admin/accounts")]
[Authorize(Policy = AdminAuthorizationPolicies.AdminPolicy)]
public class AdminAccountsController : ControllerBase
{
    private readonly IAdminUserService _adminUserService;

    public AdminAccountsController(IAdminUserService adminUserService)
    {
        _adminUserService = adminUserService;
    }

    [HttpPost("{accountId:int}/deactivate")]
    public async Task<IActionResult> DeactivateAccount(int accountId, [FromBody] AdminActionRequest? request)
    {
        var actorUserId = GetUserId();
        if (string.IsNullOrWhiteSpace(actorUserId))
        {
            return Unauthorized();
        }

        var actorRole = GetActorRole();
        var result = await _adminUserService.DeactivateAccountAsync(actorUserId, actorRole, accountId, request?.Reason);
        return ToMutationResponse(result, accountId);
    }

    [HttpPost("{accountId:int}/reactivate")]
    public async Task<IActionResult> ReactivateAccount(int accountId, [FromBody] AdminActionRequest? request)
    {
        var actorUserId = GetUserId();
        if (string.IsNullOrWhiteSpace(actorUserId))
        {
            return Unauthorized();
        }

        var actorRole = GetActorRole();
        var result = await _adminUserService.ReactivateAccountAsync(actorUserId, actorRole, accountId, request?.Reason);
        return ToMutationResponse(result, accountId);
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

    private IActionResult ToMutationResponse(AdminMutationResult result, int targetAccountId)
    {
        if (result.Succeeded)
        {
            return Ok(new
            {
                requestId = HttpContext.TraceIdentifier,
                performedBy = GetUserId(),
                performedAtUtc = DateTime.UtcNow,
                targetId = targetAccountId
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

        if (result.ErrorCode is "AccountAlreadyDeactivated" or "AccountAlreadyActive")
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
