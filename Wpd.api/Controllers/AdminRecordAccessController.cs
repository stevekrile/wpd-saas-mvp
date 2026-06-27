using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Wpd.Api.DTOs.Admin;
using Wpd.Application.Services.Admin;
using Wpd.Infrastructure.Data;

namespace Wpd.Api.Controllers;

[ApiController]
[Route("api/admin/record-access")]
[Authorize]
public class AdminRecordAccessController : ControllerBase
{
    private readonly IAdminRecordAccessService _adminRecordAccessService;
    private readonly ApplicationDbContext _context;

    public AdminRecordAccessController(IAdminRecordAccessService adminRecordAccessService, ApplicationDbContext context)
    {
        _adminRecordAccessService = adminRecordAccessService;
        _context = context;
    }

    [HttpPost("query")]
    [ProducesResponseType(typeof(AdminQueryResponseDto<AdminRecordAccessResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Query([FromBody] AdminRecordAccessRequestDto? request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.RecordType) || string.IsNullOrWhiteSpace(request.RecordId) || string.IsNullOrWhiteSpace(request.Reason))
        {
            return BadRequest(new AdminErrorResponseDto
            {
                RequestId = HttpContext.TraceIdentifier,
                ErrorCode = "ValidationError",
                Message = "recordType, recordId, and reason are required."
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

        var result = await _adminRecordAccessService.QueryRecordAsync(actorUserId, actorRole, request.RecordType, request.RecordId, request.Reason);
        return ToQueryResponse(result);
    }

    [HttpGet("history")]
    [ProducesResponseType(typeof(AdminQueryResponseDto<IReadOnlyList<AdminRecordAccessHistoryDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetHistory([FromQuery] DateTime? fromUtc, [FromQuery] DateTime? toUtc, [FromQuery] string? actorUserId = null)
    {
        if (!fromUtc.HasValue || !toUtc.HasValue)
        {
            return BadRequest(new AdminErrorResponseDto
            {
                RequestId = HttpContext.TraceIdentifier,
                ErrorCode = "InvalidDateRange",
                Message = "fromUtc and toUtc are required."
            });
        }

        var actor = GetUserId();
        if (string.IsNullOrWhiteSpace(actor))
        {
            return Unauthorized();
        }

        var actorRole = await GetActorRoleAsync(actor);
        if (!IsAdminRole(actorRole))
        {
            return Forbid();
        }

        var result = await _adminRecordAccessService.GetHistoryAsync(
            actor,
            actorRole,
            DateTime.SpecifyKind(fromUtc.Value, DateTimeKind.Utc),
            DateTime.SpecifyKind(toUtc.Value, DateTimeKind.Utc),
            actorUserId);

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

        return result.ErrorCode switch
        {
            "ScopeForbidden" => StatusCode(StatusCodes.Status403Forbidden, new AdminErrorResponseDto
            {
                RequestId = HttpContext.TraceIdentifier,
                ErrorCode = result.ErrorCode ?? string.Empty,
                Message = result.Message ?? string.Empty
            }),
            "TargetRecordNotFound" => NotFound(new AdminErrorResponseDto
            {
                RequestId = HttpContext.TraceIdentifier,
                ErrorCode = result.ErrorCode ?? string.Empty,
                Message = result.Message ?? string.Empty
            }),
            _ => BadRequest(new AdminErrorResponseDto
            {
                RequestId = HttpContext.TraceIdentifier,
                ErrorCode = result.ErrorCode ?? string.Empty,
                Message = result.Message ?? string.Empty
            })
        };
    }
}
