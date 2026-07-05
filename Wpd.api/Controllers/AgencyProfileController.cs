using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Wpd.Api.DTOs.Agency;
using Wpd.Application.Services.Agency;

namespace Wpd.Api.Controllers;

[ApiController]
[Route("api/agency-profile")]
[Authorize]
public class AgencyProfileController : ControllerBase
{
    private readonly IAgencyProfileService _agencyProfileService;

    public AgencyProfileController(IAgencyProfileService agencyProfileService)
    {
        _agencyProfileService = agencyProfileService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAgencyProfile()
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var profile = await _agencyProfileService.GetProfileAsync(userId);
        if (profile == null)
        {
            return NotFound(new { error = "User profile not found. Call /api/auth/provision first." });
        }

        return Ok(MapResponse(profile));
    }

    [HttpPut("lenses/{lensKey}/statements/{statementNumber:int}")]
    public async Task<IActionResult> SaveStatementScore(
        string lensKey,
        int statementNumber,
        [FromBody] SaveAgencyStatementScoreRequest request)
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var (succeeded, profile, error) = await _agencyProfileService.SaveStatementScoreAsync(
            userId,
            lensKey,
            statementNumber,
            request.Score);

        if (!succeeded)
        {
            if (error.Contains("not found", StringComparison.OrdinalIgnoreCase))
            {
                return NotFound(new { error });
            }

            return BadRequest(new { error });
        }

        return Ok(MapResponse(profile!));
    }

    private string GetUserId() =>
        User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? string.Empty;

    private static AgencyProfileResponse MapResponse(AgencyProfileModel profile)
    {
        return new AgencyProfileResponse
        {
            UserId = profile.UserId,
            UpdatedAt = profile.UpdatedAt,
            Lenses = profile.Lenses.Select(lens => new AgencyLensResponse
            {
                LensKey = lens.LensKey,
                LensName = lens.LensName,
                AgencyScore = lens.AgencyScore,
                AnsweredStatements = lens.AnsweredStatements,
                TotalStatements = lens.TotalStatements,
                Statements = lens.Statements.Select(statement => new AgencyStatementResponse
                {
                    StatementNumber = statement.StatementNumber,
                    StatementText = statement.StatementText,
                    Score = statement.Score
                }).ToList()
            }).ToList()
        };
    }
}
