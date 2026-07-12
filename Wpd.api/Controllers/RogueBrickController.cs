using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Wpd.Api.DTOs.Game;
using Wpd.Domain.Entities;
using Wpd.Infrastructure.Data;

namespace Wpd.Api.Controllers;

[ApiController]
[Route("api/rogue-brick")]
[Authorize]
public class RogueBrickController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public RogueBrickController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet("progress")]
    public async Task<IActionResult> GetProgress()
    {
        var userId = GetUserId();
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized();
        }

        var userExists = await _context.WpdUsers.AnyAsync(u => u.Id == userId);
        if (!userExists)
        {
            return NotFound(new { error = "User profile not found. Call /api/auth/provision first." });
        }

        var entry = await _context.UserGameProgressEntries
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == userId);

        if (entry == null)
        {
            return Ok(new RogueBrickProgressResponse
            {
                ProgressJson = string.Empty,
                UpdatedAtEpochMs = 0
            });
        }

        return Ok(ToResponse(entry));
    }

    [HttpPut("progress")]
    public async Task<IActionResult> SaveProgress([FromBody] SaveRogueBrickProgressRequest request)
    {
        var userId = GetUserId();
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(request.ProgressJson))
        {
            return BadRequest(new { error = "ProgressJson is required." });
        }

        if (request.ProgressJson.Length > 64000)
        {
            return BadRequest(new { error = "ProgressJson is too large." });
        }

        try
        {
            using var parsedDocument = System.Text.Json.JsonDocument.Parse(request.ProgressJson);
        }
        catch (System.Text.Json.JsonException)
        {
            return BadRequest(new { error = "ProgressJson must be valid JSON." });
        }

        var userExists = await _context.WpdUsers.AnyAsync(u => u.Id == userId);
        if (!userExists)
        {
            return NotFound(new { error = "User profile not found. Call /api/auth/provision first." });
        }

        var now = DateTime.UtcNow;
        var entry = await _context.UserGameProgressEntries
            .FirstOrDefaultAsync(p => p.UserId == userId);

        if (entry == null)
        {
            entry = new UserGameProgress
            {
                UserId = userId,
                ProgressJson = request.ProgressJson,
                UpdatedAtUtc = now
            };
            _context.UserGameProgressEntries.Add(entry);
        }
        else
        {
            entry.ProgressJson = request.ProgressJson;
            entry.UpdatedAtUtc = now;
        }

        await _context.SaveChangesAsync();
        return Ok(ToResponse(entry));
    }

    private string GetUserId() =>
        User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? string.Empty;

    private static RogueBrickProgressResponse ToResponse(UserGameProgress entry)
    {
        var updatedAtEpochMs = new DateTimeOffset(DateTime.SpecifyKind(entry.UpdatedAtUtc, DateTimeKind.Utc))
            .ToUnixTimeMilliseconds();

        return new RogueBrickProgressResponse
        {
            ProgressJson = entry.ProgressJson,
            UpdatedAtEpochMs = updatedAtEpochMs
        };
    }
}
