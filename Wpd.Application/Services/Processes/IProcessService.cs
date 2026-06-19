using Wpd.Domain.Entities;

namespace Wpd.Application.Services.Processes;

public interface IProcessService
{
    Task<(bool Succeeded, Process? Process, string Error, bool IsTierLimit)> CreateProcessAsync(
        string userId, 
        string name, 
        string description, 
        string problemStatement, 
        string context);

    Task<List<Process>> GetUserProcessesAsync(string userId);
    Task<Process?> GetProcessByIdAsync(int processId, string userId);
    Task<bool> UpdateProcessAsync(int processId, string userId, string name, string description, string problemStatement, string context, string status);
    Task<bool> DeleteProcessAsync(int processId, string userId);
    Task<(bool CanCreate, int CurrentCount, int MaxAllowed, string TierName)> CheckProcessLimitAsync(string userId);
    Task<Diagnostic?> StartOrGetDiagnosticAsync(int processId, string userId);
    Task<bool> SaveDiagnosticResponseAsync(int processId, string userId, int questionId, int numericResponse, string textResponse);
    Task<bool> SaveDiagnosticLensNoteAsync(int processId, string userId, string lensKey, string noteText);
}