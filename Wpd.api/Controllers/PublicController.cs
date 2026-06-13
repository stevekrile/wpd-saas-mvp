using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Wpd.Api.DTOs.Public;
using Wpd.Infrastructure.Data;

namespace Wpd.Api.Controllers;

[ApiController]
[Route("api/public")]
public class PublicController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public PublicController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet("lenses")]
    public async Task<IActionResult> GetLenses()
    {
        var lenses = await _context.Lenses
            .AsNoTracking()
            .OrderBy(l => l.DisplayOrder)
            .Select(l => new LensPublicResponse
            {
                Id = l.Id,
                Name = l.Name,
                Code = l.Code,
                DisplayOrder = l.DisplayOrder,
                PublicDescription = l.PublicDescription
            })
            .ToListAsync();

        return Ok(lenses);
    }

    [HttpGet("content/landing")]
    public IActionResult GetLandingContent()
    {
        var content = new LandingContentResponse
        {
            Title = "Whole Process Design",
            Subtitle = "A practical way to diagnose where your systems are weak and take structured action.",
            Highlights = new List<string>
            {
                "Clarify process friction across four system lenses",
                "Guide teams from diagnosis to focused improvement",
                "Build momentum without exposing proprietary method internals"
            },
            DistressSignals = new List<string>
            {
                "Rework and missed handoffs",
                "Inconsistent process outcomes",
                "System drift and unclear ownership",
                "Expert-centric workflows that block novice users"
            },
            CallToActionText = "Create a free account to run your first diagnostic",
            CallToActionRoute = "/register"
        };

        return Ok(content);
    }
}
