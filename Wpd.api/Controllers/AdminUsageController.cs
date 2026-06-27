using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Wpd.Api.Security;
using Wpd.Application.Services.Admin;

namespace Wpd.Api.Controllers;

[ApiController]
[Route("api/admin/usage")]
[Authorize(Policy = AdminAuthorizationPolicies.AdminPolicy)]
public class AdminUsageController : ControllerBase
{
    private readonly IAdminUsageService _adminUsageService;

    public AdminUsageController(IAdminUsageService adminUsageService)
    {
        _adminUsageService = adminUsageService;
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary([FromQuery] DateTime? fromUtc, [FromQuery] DateTime? toUtc, [FromQuery] int? workspaceId)
    {
        if (!TryValidateDateRange(fromUtc, toUtc, out var from, out var to, out var validationError))
        {
            return validationError!;
        }

        var actorUserId = GetUserId();
        if (string.IsNullOrWhiteSpace(actorUserId))
        {
            return Unauthorized();
        }

        var result = await _adminUsageService.GetUsageSummaryAsync(actorUserId, GetActorRole(), from, to, workspaceId);
        return ToQueryResponse(result);
    }

    [HttpGet("users/{userId}")]
    public async Task<IActionResult> GetUserUsage(string userId, [FromQuery] DateTime? fromUtc, [FromQuery] DateTime? toUtc)
    {
        if (!TryValidateDateRange(fromUtc, toUtc, out var from, out var to, out var validationError))
        {
            return validationError!;
        }

        var actorUserId = GetUserId();
        if (string.IsNullOrWhiteSpace(actorUserId))
        {
            return Unauthorized();
        }

        var result = await _adminUsageService.GetUserUsageAsync(actorUserId, GetActorRole(), userId, from, to);
        return ToQueryResponse(result);
    }

    [HttpGet("ai-tokens")]
    public async Task<IActionResult> GetAiTokenUsage([FromQuery] DateTime? fromUtc, [FromQuery] DateTime? toUtc, [FromQuery] int? workspaceId)
    {
        if (!TryValidateDateRange(fromUtc, toUtc, out var from, out var to, out var validationError))
        {
            return validationError!;
        }

        var actorUserId = GetUserId();
        if (string.IsNullOrWhiteSpace(actorUserId))
        {
            return Unauthorized();
        }

        var result = await _adminUsageService.GetAiTokenUsageAsync(actorUserId, GetActorRole(), from, to, workspaceId);
        return ToQueryResponse(result);
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

    private bool TryValidateDateRange(DateTime? fromUtc, DateTime? toUtc, out DateTime from, out DateTime to, out IActionResult? validationError)
    {
        if (!fromUtc.HasValue || !toUtc.HasValue)
        {
            validationError = BadRequest(new
            {
                requestId = HttpContext.TraceIdentifier,
                errorCode = "InvalidDateRange",
                message = "fromUtc and toUtc are required."
            });
            from = default;
            to = default;
            return false;
        }

        from = DateTime.SpecifyKind(fromUtc.Value, DateTimeKind.Utc);
        to = DateTime.SpecifyKind(toUtc.Value, DateTimeKind.Utc);

        if (from > to)
        {
            validationError = BadRequest(new
            {
                requestId = HttpContext.TraceIdentifier,
                errorCode = "InvalidDateRange",
                message = "fromUtc must be less than or equal to toUtc."
            });
            return false;
        }

        validationError = null;
        return true;
    }

    private IActionResult ToQueryResponse<T>(AdminQueryResult<T> result)
    {
        if (result.Succeeded)
        {
            return Ok(new
            {
                requestId = HttpContext.TraceIdentifier,
                performedAtUtc = DateTime.UtcNow,
                data = result.Data
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

        if (result.ErrorCode is "TargetUserNotFound" or "WorkspaceNotFound")
        {
            return NotFound(new
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
