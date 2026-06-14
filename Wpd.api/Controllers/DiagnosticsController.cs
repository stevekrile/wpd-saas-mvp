using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Wpd.Api.DTOs.Diagnostics;
using Wpd.Application.Services.Processes;

namespace Wpd.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DiagnosticsController : ControllerBase
{
    private readonly IProcessService _processService;

    public DiagnosticsController(IProcessService processService)
    {
        _processService = processService;
    }

    private string GetUserId()
    {
        return User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? string.Empty;
    }

    [HttpGet("{processId}")]
    public async Task<IActionResult> GetDiagnostic(int processId)
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var diagnostic = await _processService.StartOrGetDiagnosticAsync(processId, userId);
        if (diagnostic == null)
        {
            return NotFound();
        }

        var response = new LoadDiagnosticResponse
        {
            DiagnosticId = diagnostic.Id,
            ProcessId = diagnostic.ProcessId,
            Status = diagnostic.Status.ToString(),
            Questions = diagnostic.DiagnosticResponses.Select(r => new DiagnosticResponseData
            {
                QuestionId = r.DiagnosticQuestionId,
                NumericResponse = r.NumericResponse ?? 0,
                TextResponse = r.TextResponse ?? string.Empty,
                AnsweredAt = r.UpdatedAt
            }).ToList()
        };

        return Ok(response);
    }

    [HttpPut("{processId}/questions/{questionId}")]
    public async Task<IActionResult> SaveDiagnosticResponse(
        int processId,
        int questionId,
        [FromBody] SaveDiagnosticResponseRequest request)
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var succeeded = await _processService.SaveDiagnosticResponseAsync(
            processId,
            userId,
            questionId,
            request.NumericResponse,
            request.TextResponse);

        if (!succeeded)
        {
            return NotFound();
        }

        return NoContent();
    }
}
