namespace Wpd.Api.Services.Llm;

public sealed class LlmHarnessOptions
{
    public OpenAiLlmOptions OpenAI { get; init; } = new();
    public AnthropicLlmOptions Anthropic { get; init; } = new();
}

public sealed class OpenAiLlmOptions
{
    public string Model { get; init; } = "gpt-4o-mini";
    public string BaseUrl { get; init; } = "https://api.openai.com/v1";
}

public sealed class AnthropicLlmOptions
{
    public string Model { get; init; } = "claude-3-5-sonnet-latest";
    public string BaseUrl { get; init; } = "https://api.anthropic.com";
    public int MaxTokens { get; init; } = 2500;
}
