using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Wpd.Api.DTOs.Auth;
using Wpd.Application.Services.Auth;
using Wpd.Infrastructure.Data;
using Wpd.Infrastructure.Identity;

namespace Wpd.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ApplicationDbContext _context;

    public AuthController(IAuthService authService, ApplicationDbContext context)
    {
        _authService = authService;
        _context = context;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        var (succeeded, userId, error) = await _authService.RegisterAsync(
            request.Email,
            request.Password,
            request.DisplayName);

        if (!succeeded)
        {
            return BadRequest(new { error });
        }

        // Get the user to generate token
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            return BadRequest(new { error = "User creation failed." });
        }

        var token = await _authService.GenerateJwtTokenAsync(user);
        var tier = await _context.SubscriptionTiers.FindAsync(user.SubscriptionTierId);

        return Ok(new AuthResponse
        {
            UserId = user.Id,
            Email = user.Email ?? string.Empty,
            DisplayName = user.DisplayName,
            Token = token,
            SubscriptionTierId = user.SubscriptionTierId,
            SubscriptionTierName = tier?.Name ?? "Unknown"
        });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var (succeeded, user, error) = await _authService.LoginAsync(request.Email, request.Password);

        if (!succeeded || user == null)
        {
            return Unauthorized(new { error });
        }

        var token = await _authService.GenerateJwtTokenAsync(user);
        var tier = await _context.SubscriptionTiers.FindAsync(user.SubscriptionTierId);

        return Ok(new AuthResponse
        {
            UserId = user.Id,
            Email = user.Email ?? string.Empty,
            DisplayName = user.DisplayName,
            Token = token,
            SubscriptionTierId = user.SubscriptionTierId,
            SubscriptionTierName = tier?.Name ?? "Unknown"
        });
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> GetCurrentUser()
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            return NotFound();
        }

        var tier = await _context.SubscriptionTiers.FindAsync(user.SubscriptionTierId);

        return Ok(new UserResponse
        {
            UserId = user.Id,
            Email = user.Email ?? string.Empty,
            DisplayName = user.DisplayName,
            SubscriptionTierId = user.SubscriptionTierId,
            SubscriptionTierName = tier?.Name ?? "Unknown",
            DefaultWorkspaceId = user.DefaultWorkspaceId
        });
    }
}