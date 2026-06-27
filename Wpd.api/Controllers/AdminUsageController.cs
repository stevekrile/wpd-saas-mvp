using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Wpd.Application.Services.Admin;
using Wpd.Infrastructure.Data;

namespace Wpd.Api.Controllers;

[ApiController]
[Route("api/admin/usage")]
[Authorize]
public class AdminUsageController : ControllerBase
{
    private readonly IAdminUsageService _adminUsageService;
    private readonly ApplicationDbContext _context;

    public AdminUsageController(IAdminUsageService adminUsageService, ApplicationDbContext context)
    {
        _adminUsageService = adminUsageService;
        _context = context;
    }

    [HttpGet("summary")]
    [ProducesResponseType(typeof(AdminQueryResponseDto<AdminUsageSummaryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status403Forbidden)]
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

        var actorRole = await GetActorRoleAsync(actorUserId);
        if (!IsAdminRole(actorRole))
        {
            return Forbid();
        }

        var result = await _adminUsageService.GetUsageSummaryAsync(actorUserId, actorRole, from, to, workspaceId);
        return ToQueryResponse(result);
    }

    [HttpGet("users/{userId}")]
    [ProducesResponseType(typeof(AdminQueryResponseDto<AdminUserUsageDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status404NotFound)]
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

        var actorRole = await GetActorRoleAsync(actorUserId);
        if (!IsAdminRole(actorRole))
        {
            return Forbid();
        }

        var result = await _adminUsageService.GetUserUsageAsync(actorUserId, actorRole, userId, from, to);
        return ToQueryResponse(result);
    }

    [HttpGet("ai-tokens")]
    [ProducesResponseType(typeof(AdminQueryResponseDto<IReadOnlyList<AdminAiTokenUsageRowDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status403Forbidden)]
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

        var actorRole = await GetActorRoleAsync(actorUserId);
        if (!IsAdminRole(actorRole))
        {
            return Forbid();
        }

        var result = await _adminUsageService.GetAiTokenUsageAsync(actorUserId, actorRole, from, to, workspaceId);
        return ToQueryResponse(result);
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

    private bool TryValidateDateRange(DateTime? fromUtc, DateTime? toUtc, out DateTime from, out DateTime to, out IActionResult? validationError)
    {
        if (!fromUtc.HasValue || !toUtc.HasValue)
        {
            validationError = BadRequest(new AdminErrorResponseDto
            {
                RequestId = HttpContext.TraceIdentifier,
                ErrorCode = "InvalidDateRange",
                Message = "fromUtc and toUtc are required."
            });
            from = default;
            to = default;
            return false;
        }

        from = DateTime.SpecifyKind(fromUtc.Value, DateTimeKind.Utc);
        to = DateTime.SpecifyKind(toUtc.Value, DateTimeKind.Utc);

        if (from > to)
        {
            validationError = BadRequest(new AdminErrorResponseDto
            {
                RequestId = HttpContext.TraceIdentifier,
                ErrorCode = "InvalidDateRange",
                Message = "fromUtc must be less than or equal to toUtc."
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
            return Ok(new AdminQueryResponseDto<T>
            {
                RequestId = HttpContext.TraceIdentifier,
                PerformedBy = GetUserId(),
                PerformedAtUtc = DateTime.UtcNow,
                Data = result.Data
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

        if (result.ErrorCode is "TargetUserNotFound" or "WorkspaceNotFound")
        {
            return NotFound(new AdminErrorResponseDto
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
