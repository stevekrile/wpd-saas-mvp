using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Wpd.Api.DTOs.Admin;
using Wpd.Application.Services.Admin;
using Wpd.Infrastructure.Data;

namespace Wpd.Api.Controllers;

[ApiController]
[Route("api/admin/accounts")]
[Authorize]
public class AdminAccountsController : ControllerBase
{
    private readonly IAdminUserService _adminUserService;
    private readonly ApplicationDbContext _context;

    public AdminAccountsController(IAdminUserService adminUserService, ApplicationDbContext context)
    {
        _adminUserService = adminUserService;
        _context = context;
    }

    [HttpPost("{accountId:int}/deactivate")]
    [ProducesResponseType(typeof(AdminMutationResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> DeactivateAccount(int accountId, [FromBody] AdminActionRequest? request)
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

        var result = await _adminUserService.DeactivateAccountAsync(actorUserId, actorRole, accountId, request?.Reason);
        return ToMutationResponse(result, accountId);
    }

    [HttpPost("{accountId:int}/reactivate")]
    [ProducesResponseType(typeof(AdminMutationResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(AdminErrorResponseDto), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> ReactivateAccount(int accountId, [FromBody] AdminActionRequest? request)
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

        var result = await _adminUserService.ReactivateAccountAsync(actorUserId, actorRole, accountId, request?.Reason);
        return ToMutationResponse(result, accountId);
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

    private IActionResult ToMutationResponse(AdminMutationResult result, int targetAccountId)
    {
        if (result.Succeeded)
        {
            return Ok(new AdminMutationResponseDto
            {
                RequestId = HttpContext.TraceIdentifier,
                PerformedBy = GetUserId(),
                PerformedAtUtc = DateTime.UtcNow,
                TargetId = targetAccountId.ToString()
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

        if (result.ErrorCode is "AccountAlreadyDeactivated" or "AccountAlreadyActive")
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
