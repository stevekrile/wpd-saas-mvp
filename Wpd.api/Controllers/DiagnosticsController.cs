using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Wpd.Api.DTOs.Diagnostics;
using Wpd.Api.Services.Llm;
using Wpd.Application.Services.Processes;

namespace Wpd.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DiagnosticsController : ControllerBase
{
    private static readonly HashSet<string> SupportedLensKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "business",
        "information",
        "human",
        "organizational"
    };

    private readonly IProcessService _processService;
    private readonly ILlmHarnessService _llmHarnessService;

    public DiagnosticsController(IProcessService processService, ILlmHarnessService llmHarnessService)
    {
        _processService = processService;
        _llmHarnessService = llmHarnessService;
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
            }).ToList(),
            LensNotes = diagnostic.DiagnosticLensNotes.Select(note => new DiagnosticLensNoteData
            {
                LensKey = note.LensKey,
                NoteText = note.NoteText,
                UpdatedAt = note.UpdatedAt
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

    [HttpPut("{processId}/lenses/{lensKey}/notes")]
    public async Task<IActionResult> SaveDiagnosticLensNote(
        int processId,
        string lensKey,
        [FromBody] SaveDiagnosticLensNoteRequest request)
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var normalizedLensKey = lensKey.Trim().ToLowerInvariant();
        if (!SupportedLensKeys.Contains(normalizedLensKey))
        {
            return BadRequest($"Unsupported lens key '{lensKey}'.");
        }

        var succeeded = await _processService.SaveDiagnosticLensNoteAsync(
            processId,
            userId,
            normalizedLensKey,
            request.NoteText);

        if (!succeeded)
        {
            return NotFound();
        }

        return NoContent();
    }

    [HttpPost("{processId}/llm-harness")]
    public async Task<IActionResult> SendLlmHarnessPrompt(
        int processId,
        [FromBody] SendLlmHarnessRequest request,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var process = await _processService.GetProcessByIdAsync(processId, userId);
        if (process == null)
        {
            return NotFound();
        }

        if (string.IsNullOrWhiteSpace(request.Provider))
        {
            return BadRequest("Provider is required.");
        }

        if (string.IsNullOrWhiteSpace(request.Prompt))
        {
            return BadRequest("Prompt is required.");
        }

        var archived = await _processService.ArchiveCurrentDiagnosticLlmResultAsync(processId, userId);
        if (!archived)
        {
            return NotFound();
        }

        var result = await _llmHarnessService.SendPromptAsync(userId, request.Provider, request.Prompt, cancellationToken);
        if (!result.Succeeded)
        {
            if (result.Error.Contains("Unsupported provider", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { error = result.Error });
            }

            if (result.Error.Contains("No ", StringComparison.OrdinalIgnoreCase) && result.Error.Contains("credential", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { error = result.Error });
            }

            return StatusCode(StatusCodes.Status502BadGateway, new { error = result.Error });
        }

        var saved = await _processService.SaveDiagnosticLlmResultAsync(
            processId,
            userId,
            result.Completion,
            result.Provider,
            result.Model,
            result.PromptTokens,
            result.CompletionTokens,
            result.TotalTokens);
        if (!saved)
        {
            return NotFound();
        }

        return Ok(new SendLlmHarnessResponse
        {
            Provider = result.Provider,
            Model = result.Model,
            Completion = result.Completion,
            PromptTokens = result.PromptTokens,
            CompletionTokens = result.CompletionTokens,
            TotalTokens = result.TotalTokens
        });
    }

    [HttpGet("{processId}/llm-result")]
    public async Task<IActionResult> GetDiagnosticLlmResult(int processId)
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var process = await _processService.GetProcessByIdAsync(processId, userId);
        if (process == null)
        {
            return NotFound();
        }

        var result = await _processService.GetDiagnosticLlmResultAsync(processId, userId);
        return Ok(new GetDiagnosticLlmResultResponse
        {
            ResultMarkdown = result.ResultMarkdown,
            Provider = result.Provider,
            Model = result.Model,
            PromptTokens = result.PromptTokens,
            CompletionTokens = result.CompletionTokens,
            TotalTokens = result.TotalTokens
        });
    }

    [HttpGet("{processId}/llm-result-history")]
    public async Task<IActionResult> GetDiagnosticLlmResultHistory(int processId)
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var process = await _processService.GetProcessByIdAsync(processId, userId);
        if (process == null)
        {
            return NotFound();
        }

        var historyItems = await _processService.GetDiagnosticLlmResultHistoryAsync(processId, userId);
        return Ok(new GetDiagnosticLlmResultHistoryResponse
        {
            Items = historyItems.Select(item => new DiagnosticLlmResultHistoryItemResponse
            {
                Id = item.Id,
                ResultMarkdown = item.ResultMarkdown,
                Provider = item.Provider ?? string.Empty,
                Model = item.Model ?? string.Empty,
                PromptTokens = item.PromptTokens,
                CompletionTokens = item.CompletionTokens,
                TotalTokens = item.TotalTokens,
                CreatedAt = item.CreatedAt
            }).ToList()
        });
    }

    [HttpDelete("{processId}/llm-result-history/{historyItemId}")]
    public async Task<IActionResult> DeleteDiagnosticLlmResultHistoryItem(int processId, int historyItemId)
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var process = await _processService.GetProcessByIdAsync(processId, userId);
        if (process == null)
        {
            return NotFound();
        }

        var deleted = await _processService.DeleteDiagnosticLlmResultHistoryItemAsync(processId, userId, historyItemId);
        if (!deleted)
        {
            return NotFound();
        }

        return NoContent();
    }

    [HttpPut("{processId}/llm-result")]
    public async Task<IActionResult> SaveDiagnosticLlmResult(
        int processId,
        [FromBody] SaveDiagnosticLlmResultRequest request)
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var process = await _processService.GetProcessByIdAsync(processId, userId);
        if (process == null)
        {
            return NotFound();
        }

        var succeeded = await _processService.SaveDiagnosticLlmResultAsync(
            processId,
            userId,
            request.ResultMarkdown,
            request.Provider,
            request.Model,
            request.PromptTokens,
            request.CompletionTokens,
            request.TotalTokens);
        if (!succeeded)
        {
            return NotFound();
        }

        return NoContent();
    }
}
