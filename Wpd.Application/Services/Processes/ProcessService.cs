using Microsoft.EntityFrameworkCore;
using Wpd.Domain.Entities;
using Wpd.Domain.Enums;
using Wpd.Infrastructure.Data;

namespace Wpd.Application.Services.Processes;

public class ProcessService : IProcessService
{
    private readonly ApplicationDbContext _context;

    public ProcessService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<(bool CanCreate, int CurrentCount, int MaxAllowed, string TierName)> CheckProcessLimitAsync(string userId)
    {
        var user = await _context.WpdUsers.FindAsync(userId);
        if (user == null)
        {
            return (false, 0, 0, "Unknown");
        }

        var tier = await _context.SubscriptionTiers.FindAsync(user.SubscriptionTierId);
        if (tier == null)
        {
            return (false, 0, 0, "Unknown");
        }

        var workspace = await _context.Workspaces
            .FirstOrDefaultAsync(w => w.OwnerUserId == userId && w.WorkspaceType == WorkspaceType.Personal);

        if (workspace == null)
        {
            return (false, 0, tier.MaxActiveProcesses, tier.Name);
        }

        var activeProcessCount = await _context.Processes
            .CountAsync(p => p.WorkspaceId == workspace.Id && p.Status == ProcessStatus.Active);

        // -1 means unlimited
        bool canCreate = tier.MaxActiveProcesses == -1 || activeProcessCount < tier.MaxActiveProcesses;

        return (canCreate, activeProcessCount, tier.MaxActiveProcesses, tier.Name);
    }

    public async Task<(bool Succeeded, Process? Process, string Error, bool IsTierLimit)> CreateProcessAsync(
        string userId,
        string name,
        string description,
        string problemStatement,
        string context)
    {
        // Check tier limit
        var (canCreate, currentCount, maxAllowed, tierName) = await CheckProcessLimitAsync(userId);

        if (!canCreate)
        {
            return (false, null, $"Process limit reached for {tierName} tier.", true);
        }

        // Get user's workspace
        var workspace = await _context.Workspaces
            .FirstOrDefaultAsync(w => w.OwnerUserId == userId && w.WorkspaceType == WorkspaceType.Personal);

        if (workspace == null)
        {
            return (false, null, "User workspace not found.", false);
        }

        var process = new Process
        {
            WorkspaceId = workspace.Id,
            OwnerUserId = userId,
            Name = name,
            Description = description,
            ProblemStatement = problemStatement,
            Context = context,
            Status = ProcessStatus.Active,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Processes.Add(process);
        await _context.SaveChangesAsync();

        return (true, process, string.Empty, false);
    }

    public async Task<List<Process>> GetUserProcessesAsync(string userId)
    {
        var workspace = await _context.Workspaces
            .FirstOrDefaultAsync(w => w.OwnerUserId == userId && w.WorkspaceType == WorkspaceType.Personal);

        if (workspace == null)
        {
            return new List<Process>();
        }

        return await _context.Processes
            .Where(p => p.WorkspaceId == workspace.Id)
            .OrderByDescending(p => p.UpdatedAt)
            .ToListAsync();
    }

    public async Task<Process?> GetProcessByIdAsync(int processId, string userId)
    {
        return await _context.Processes
            .FirstOrDefaultAsync(p => p.Id == processId && p.OwnerUserId == userId);
    }

    public async Task<bool> UpdateProcessAsync(
        int processId,
        string userId,
        string name,
        string description,
        string problemStatement,
        string context,
        string status)
    {
        var process = await GetProcessByIdAsync(processId, userId);
        if (process == null)
        {
            return false;
        }

        process.Name = name;
        process.Description = description;
        process.ProblemStatement = problemStatement;
        process.Context = context;

        if (Enum.TryParse<ProcessStatus>(status, out var parsedStatus))
        {
            process.Status = parsedStatus;
        }

        process.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteProcessAsync(int processId, string userId)
    {
        var process = await GetProcessByIdAsync(processId, userId);
        if (process == null)
        {
            return false;
        }

        _context.Processes.Remove(process);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<Diagnostic?> StartOrGetDiagnosticAsync(int processId, string userId)
    {
        var process = await GetProcessByIdAsync(processId, userId);
        if (process == null)
        {
            return null;
        }

        var diagnostic = await _context.Diagnostics
            .FirstOrDefaultAsync(d => d.ProcessId == processId && d.UserId == userId);

        if (diagnostic == null)
        {
            diagnostic = new Diagnostic
            {
                ProcessId = processId,
                UserId = userId,
                Status = DiagnosticStatus.Draft,
                CreatedAt = DateTime.UtcNow,
                OverallSummary = string.Empty
            };

            _context.Diagnostics.Add(diagnostic);
            await _context.SaveChangesAsync();
        }

        return diagnostic;
    }

    public async Task<bool> SaveDiagnosticResponseAsync(int processId, string userId, int questionId, int numericResponse, string textResponse)
    {
        var diagnostic = await StartOrGetDiagnosticAsync(processId, userId);
        if (diagnostic == null)
        {
            return false;
        }

        var response = await _context.DiagnosticResponses
            .FirstOrDefaultAsync(r => r.DiagnosticId == diagnostic.Id && r.DiagnosticQuestionId == questionId);

        if (response == null)
        {
            response = new DiagnosticResponse
            {
                DiagnosticId = diagnostic.Id,
                DiagnosticQuestionId = questionId,
                CreatedAt = DateTime.UtcNow
            };
            _context.DiagnosticResponses.Add(response);
        }

        response.NumericResponse = numericResponse;
        response.TextResponse = textResponse;
        response.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return true;
    }
}