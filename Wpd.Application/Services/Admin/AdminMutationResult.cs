namespace Wpd.Application.Services.Admin;

public sealed class AdminMutationResult
{
    public bool Succeeded { get; init; }
    public string? ErrorCode { get; init; }
    public string? Message { get; init; }

    public static AdminMutationResult Success() => new() { Succeeded = true };
    public static AdminMutationResult Failure(string errorCode, string message) =>
        new() { Succeeded = false, ErrorCode = errorCode, Message = message };
}
