using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Wpd.Api.DTOs.Auth;
using Wpd.Domain.Entities;
using Wpd.Domain.Enums;
using Wpd.Infrastructure.Data;

namespace Wpd.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private const string BootstrapSuperAdminEmail = "stevekrile@gmail.com";
    private const string SystemAdminRole = "SystemAdmin";
    private const string DefaultUserRole = "User";

    private readonly ApplicationDbContext _context;

    public AuthController(ApplicationDbContext context)
    {
        _context = context;
    }

    private string GetClerkUserId() =>
        User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? string.Empty;

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> GetCurrentUser()
    {
        var clerkUserId = GetClerkUserId();
        if (string.IsNullOrEmpty(clerkUserId))
        {
            return Unauthorized();
        }

        var user = await _context.WpdUsers.FindAsync(clerkUserId);
        if (user == null)
        {
            return NotFound(new { error = "User profile not found. Call /auth/provision first." });
        }

        await EnsureBootstrapSuperAdminAsync(user);
        await _context.SaveChangesAsync();
        var response = await BuildUserResponseAsync(user);
        return Ok(response);
    }

    [HttpPost("provision")]
    [Authorize]
    public async Task<IActionResult> Provision([FromBody] ProvisionRequest request)
    {
        var clerkUserId = GetClerkUserId();
        if (string.IsNullOrEmpty(clerkUserId))
        {
            return Unauthorized();
        }

        var existing = await _context.WpdUsers.FindAsync(clerkUserId);
        if (existing != null)
        {
            existing.LastLoginAt = DateTime.UtcNow;
            await EnsureBootstrapSuperAdminAsync(existing, request.Email);
            await _context.SaveChangesAsync();

            var existingResponse = await BuildUserResponseAsync(existing);
            return Ok(existingResponse);
        }

        var freeTier = _context.SubscriptionTiers.FirstOrDefault(t => t.Code == "FREE");
        if (freeTier == null)
        {
            return StatusCode(500, new { error = "Subscription tiers not seeded." });
        }

        var user = new WpdUser
        {
            Id = clerkUserId,
            Email = request.Email,
            DisplayName = request.DisplayName,
            CreatedAt = DateTime.UtcNow,
            LastLoginAt = DateTime.UtcNow,
            SubscriptionTierId = freeTier.Id
        };

        _context.WpdUsers.Add(user);

        var workspace = new Workspace
        {
            Name = $"{request.DisplayName}'s Workspace",
            OwnerUserId = clerkUserId,
            WorkspaceType = WorkspaceType.Personal,
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };

        _context.Workspaces.Add(workspace);
        await _context.SaveChangesAsync();

        user.DefaultWorkspaceId = workspace.Id;
        await EnsureBootstrapSuperAdminAsync(user, request.Email);
        await _context.SaveChangesAsync();

        var response = await BuildUserResponseAsync(user);
        return Ok(response);
    }

    private async Task<UserResponse> BuildUserResponseAsync(WpdUser user)
    {
        var tier = await _context.SubscriptionTiers.FindAsync(user.SubscriptionTierId);
        var role = await GetAssignedRoleAsync(user.Id, user.Email);

        return new UserResponse
        {
            UserId = user.Id,
            Email = user.Email,
            DisplayName = user.DisplayName,
            SubscriptionTierId = user.SubscriptionTierId,
            SubscriptionTierName = tier?.Name ?? "Unknown",
            DefaultWorkspaceId = user.DefaultWorkspaceId,
            Role = role
        };
    }

    private async Task<string> GetAssignedRoleAsync(string clerkUserId, string email)
    {
        var state = await _context.UserAdminStates.FindAsync(clerkUserId);
        if (state != null && !string.IsNullOrWhiteSpace(state.AssignedRole))
        {
            return state.AssignedRole;
        }

        return IsBootstrapSuperAdminEmail(email) ? SystemAdminRole : DefaultUserRole;
    }

    private async Task EnsureBootstrapSuperAdminAsync(WpdUser user, string? emailOverride = null)
    {
        var email = emailOverride ?? user.Email;
        if (!IsBootstrapSuperAdminEmail(email))
        {
            return;
        }

        var state = await _context.UserAdminStates.FindAsync(user.Id);
        if (state == null)
        {
            state = new UserAdminState
            {
                UserId = user.Id,
                IsActive = true
            };
            _context.UserAdminStates.Add(state);
        }

        state.AssignedRole = SystemAdminRole;
        state.IsActive = true;
    }

    private static bool IsBootstrapSuperAdminEmail(string email) =>
        string.Equals(email, BootstrapSuperAdminEmail, StringComparison.OrdinalIgnoreCase);
}


