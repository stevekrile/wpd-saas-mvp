namespace Wpd.Api.Services.Llm;

public static class LlmProviderCatalog
{
    public const string OpenAi = "openai";
    public const string Anthropic = "anthropic";

    public static readonly string[] SupportedProviders = { OpenAi, Anthropic };

    public static bool IsSupported(string provider) =>
        SupportedProviders.Contains(provider.Trim().ToLowerInvariant(), StringComparer.Ordinal);

    public static string Normalize(string provider) => provider.Trim().ToLowerInvariant();
}
