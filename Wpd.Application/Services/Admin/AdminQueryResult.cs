namespace Wpd.Application.Services.Admin;

public class AdminQueryResult<T>
{
    public bool Succeeded { get; init; }
    public string? ErrorCode { get; init; }
    public string? Message { get; init; }
    public T? Data { get; init; }

    public static AdminQueryResult<T> Success(T data) => new() { Succeeded = true, Data = data };
    public static AdminQueryResult<T> Failure(string errorCode, string message) =>
        new() { Succeeded = false, ErrorCode = errorCode, Message = message };
}
