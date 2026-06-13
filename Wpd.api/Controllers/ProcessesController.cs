using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Wpd.Api.DTOs.Processes;
using Wpd.Application.Services.Processes;

namespace Wpd.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProcessesController : ControllerBase
{
    private readonly IProcessService _processService;

    public ProcessesController(IProcessService processService)
    {
        _processService = processService;
    }

    private string GetUserId()
    {
        return User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? string.Empty;
    }

    [HttpGet]
    public async Task<IActionResult> GetProcesses()
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var processes = await _processService.GetUserProcessesAsync(userId);

        var response = processes.Select(p => new ProcessResponse
        {
            Id = p.Id,
            WorkspaceId = p.WorkspaceId,
            Name = p.Name,
            Description = p.Description,
            ProblemStatement = p.ProblemStatement,
            Context = p.Context,
            Status = p.Status.ToString(),
            CreatedAt = p.CreatedAt,
            UpdatedAt = p.UpdatedAt
        }).ToList();

        return Ok(response);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetProcess(int id)
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var process = await _processService.GetProcessByIdAsync(id, userId);
        if (process == null)
        {
            return NotFound();
        }

        var response = new ProcessResponse
        {
            Id = process.Id,
            WorkspaceId = process.WorkspaceId,
            Name = process.Name,
            Description = process.Description,
            ProblemStatement = process.ProblemStatement,
            Context = process.Context,
            Status = process.Status.ToString(),
            CreatedAt = process.CreatedAt,
            UpdatedAt = process.UpdatedAt
        };

        return Ok(response);
    }

    [HttpPost]
    public async Task<IActionResult> CreateProcess([FromBody] CreateProcessRequest request)
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var (succeeded, process, error, isTierLimit) = await _processService.CreateProcessAsync(
            userId,
            request.Name,
            request.Description,
            request.ProblemStatement,
            request.Context);

        if (!succeeded)
        {
            if (isTierLimit)
            {
                // Return tier limit error with upgrade prompt
                var (canCreate, currentCount, maxAllowed, tierName) = await _processService.CheckProcessLimitAsync(userId);

                return StatusCode(403, new TierLimitErrorResponse
                {
                    Error = "TierLimitReached",
                    Message = error,
                    CurrentTier = tierName,
                    CurrentProcessCount = currentCount,
                    MaxAllowedProcesses = maxAllowed,
                    UpgradePrompt = "Upgrade to Pro to create unlimited processes and unlock advanced features."
                });
            }

            return BadRequest(new { error });
        }

        var response = new ProcessResponse
        {
            Id = process!.Id,
            WorkspaceId = process.WorkspaceId,
            Name = process.Name,
            Description = process.Description,
            ProblemStatement = process.ProblemStatement,
            Context = process.Context,
            Status = process.Status.ToString(),
            CreatedAt = process.CreatedAt,
            UpdatedAt = process.UpdatedAt
        };

        return CreatedAtAction(nameof(GetProcess), new { id = process.Id }, response);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateProcess(int id, [FromBody] UpdateProcessRequest request)
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var succeeded = await _processService.UpdateProcessAsync(
            id,
            userId,
            request.Name,
            request.Description,
            request.ProblemStatement,
            request.Context,
            request.Status);

        if (!succeeded)
        {
            return NotFound();
        }

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteProcess(int id)
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var succeeded = await _processService.DeleteProcessAsync(id, userId);

        if (!succeeded)
        {
            return NotFound();
        }

        return NoContent();
    }

    [HttpGet("tier-limit")]
    public async Task<IActionResult> CheckTierLimit()
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var (canCreate, currentCount, maxAllowed, tierName) = await _processService.CheckProcessLimitAsync(userId);

        return Ok(new
        {
            canCreate,
            currentCount,
            maxAllowed = maxAllowed == -1 ? "Unlimited" : maxAllowed.ToString(),
            tierName
        });
    }
}