namespace Wpd.Application.Services.Admin;

public class AdminQueryResponseDto<T>
{
    public string RequestId { get; init; } = string.Empty;
    public string PerformedBy { get; init; } = string.Empty;
    public DateTime PerformedAtUtc { get; init; }
    public T? Data { get; init; }
}

public class AdminMutationResponseDto
{
    public string RequestId { get; init; } = string.Empty;
    public string PerformedBy { get; init; } = string.Empty;
    public DateTime PerformedAtUtc { get; init; }
    public string TargetId { get; init; } = string.Empty;
}

public class AdminErrorResponseDto
{
    public string RequestId { get; init; } = string.Empty;
    public string ErrorCode { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
}
