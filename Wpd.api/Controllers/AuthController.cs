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
    private readonly ApplicationDbContext _context;

    public AuthController(ApplicationDbContext context)
    {
        _context = context;
    }

    private string GetClerkUserId() =>
        User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? string.Empty;

    /// <summary>
    /// Returns the current user's WPD profile. Call after Clerk sign-in.
    /// </summary>
    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> GetCurrentUser()
    {
        var clerkUserId = GetClerkUserId();
        if (string.IsNullOrEmpty(clerkUserId))
            return Unauthorized();

        var user = await _context.WpdUsers.FindAsync(clerkUserId);
        if (user == null)
            return NotFound(new { error = "User profile not found. Call /auth/provision first." });

        var tier = await _context.SubscriptionTiers.FindAsync(user.SubscriptionTierId);

        return Ok(new UserResponse
        {
            UserId = user.Id,
            Email = user.Email,
            DisplayName = user.DisplayName,
            SubscriptionTierId = user.SubscriptionTierId,
            SubscriptionTierName = tier?.Name ?? "Unknown",
            DefaultWorkspaceId = user.DefaultWorkspaceId
        });
    }

    /// <summary>
    /// Creates a WPD user profile on first sign-in. Idempotent — safe to call on every sign-in.
    /// </summary>
    [HttpPost("provision")]
    [Authorize]
    public async Task<IActionResult> Provision([FromBody] ProvisionRequest request)
    {
        var clerkUserId = GetClerkUserId();
        if (string.IsNullOrEmpty(clerkUserId))
            return Unauthorized();

        var existing = await _context.WpdUsers.FindAsync(clerkUserId);
        if (existing != null)
        {
            // Update last login and return existing profile
            existing.LastLoginAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            var existingTier = await _context.SubscriptionTiers.FindAsync(existing.SubscriptionTierId);
            return Ok(new UserResponse
            {
                UserId = existing.Id,
                Email = existing.Email,
                DisplayName = existing.DisplayName,
                SubscriptionTierId = existing.SubscriptionTierId,
                SubscriptionTierName = existingTier?.Name ?? "Unknown",
                DefaultWorkspaceId = existing.DefaultWorkspaceId
            });
        }

        var freeTier = _context.SubscriptionTiers.FirstOrDefault(t => t.Code == "FREE");
        if (freeTier == null)
            return StatusCode(500, new { error = "Subscription tiers not seeded." });

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

        // Create default personal workspace
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
        await _context.SaveChangesAsync();

        var tier = await _context.SubscriptionTiers.FindAsync(user.SubscriptionTierId);

        return Ok(new UserResponse
        {
            UserId = user.Id,
            Email = user.Email,
            DisplayName = user.DisplayName,
            SubscriptionTierId = user.SubscriptionTierId,
            SubscriptionTierName = tier?.Name ?? "Unknown",
            DefaultWorkspaceId = user.DefaultWorkspaceId
        });
    }
}
