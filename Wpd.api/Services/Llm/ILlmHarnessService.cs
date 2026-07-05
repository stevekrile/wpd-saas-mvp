namespace Wpd.Api.Services.Llm;

public interface ILlmHarnessService
{
    Task<LlmHarnessResult> SendPromptAsync(string userId, string provider, string prompt, CancellationToken cancellationToken);
}

public sealed class LlmHarnessResult
{
    public bool Succeeded { get; init; }
    public string Provider { get; init; } = string.Empty;
    public string Model { get; init; } = string.Empty;
    public string Completion { get; init; } = string.Empty;
    public int? PromptTokens { get; init; }
    public int? CompletionTokens { get; init; }
    public int? TotalTokens { get; init; }
    public string Error { get; init; } = string.Empty;
}
