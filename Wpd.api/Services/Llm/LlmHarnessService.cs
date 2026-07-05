using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace Wpd.Api.Services.Llm;

public sealed class LlmHarnessService : ILlmHarnessService
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly LlmHarnessOptions _options;
    private readonly ILlmCredentialService _credentialService;

    public LlmHarnessService(
        IHttpClientFactory httpClientFactory,
        IOptions<LlmHarnessOptions> options,
        ILlmCredentialService credentialService)
    {
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
        _credentialService = credentialService;
    }

    public async Task<LlmHarnessResult> SendPromptAsync(string userId, string provider, string prompt, CancellationToken cancellationToken)
    {
        var normalizedProvider = provider.Trim().ToLowerInvariant();
        if (!LlmProviderCatalog.IsSupported(normalizedProvider))
        {
            return new LlmHarnessResult
            {
                Succeeded = false,
                Error = $"Unsupported provider '{provider}'."
            };
        }

        var (found, apiKey) = await _credentialService.GetApiKeyAsync(userId, normalizedProvider);
        if (!found)
        {
            return new LlmHarnessResult
            {
                Succeeded = false,
                Error = $"No {normalizedProvider} credential is configured for this user."
            };
        }

        return normalizedProvider switch
        {
            LlmProviderCatalog.OpenAi => await SendOpenAiAsync(prompt, apiKey, cancellationToken),
            LlmProviderCatalog.Anthropic => await SendAnthropicAsync(prompt, apiKey, cancellationToken),
            _ => new LlmHarnessResult
            {
                Succeeded = false,
                Error = $"Unsupported provider '{provider}'."
            }
        };
    }

    private async Task<LlmHarnessResult> SendOpenAiAsync(string prompt, string apiKey, CancellationToken cancellationToken)
    {
        var endpoint = $"{_options.OpenAI.BaseUrl.TrimEnd('/')}/chat/completions";
        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        request.Content = JsonContent(new
        {
            model = _options.OpenAI.Model,
            temperature = 0.3m,
            messages = new[]
            {
                new
                {
                    role = "user",
                    content = prompt
                }
            }
        });

        var client = _httpClientFactory.CreateClient();
        using var response = await client.SendAsync(request, cancellationToken);
        var payload = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            return new LlmHarnessResult
            {
                Succeeded = false,
                Error = BuildOpenAiErrorMessage((int)response.StatusCode, payload)
            };
        }

        using var json = JsonDocument.Parse(payload);
        var usage = json.RootElement.TryGetProperty("usage", out var usageElement) ? usageElement : default;
        var promptTokens = TryGetInt(usage, "prompt_tokens");
        var completionTokens = TryGetInt(usage, "completion_tokens");
        var totalTokens = TryGetInt(usage, "total_tokens");
        var completion = json.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString() ?? string.Empty;

        return new LlmHarnessResult
        {
            Succeeded = true,
            Provider = "openai",
            Model = _options.OpenAI.Model,
            Completion = completion,
            PromptTokens = promptTokens,
            CompletionTokens = completionTokens,
            TotalTokens = totalTokens
        };
    }

    private async Task<LlmHarnessResult> SendAnthropicAsync(string prompt, string apiKey, CancellationToken cancellationToken)
    {
        var endpoint = $"{_options.Anthropic.BaseUrl.TrimEnd('/')}/v1/messages";
        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
        request.Headers.Add("x-api-key", apiKey);
        request.Headers.Add("anthropic-version", "2023-06-01");
        request.Content = JsonContent(new
        {
            model = _options.Anthropic.Model,
            max_tokens = _options.Anthropic.MaxTokens,
            temperature = 0.3m,
            messages = new[]
            {
                new
                {
                    role = "user",
                    content = prompt
                }
            }
        });

        var client = _httpClientFactory.CreateClient();
        using var response = await client.SendAsync(request, cancellationToken);
        var payload = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            return new LlmHarnessResult
            {
                Succeeded = false,
                Error = BuildAnthropicErrorMessage((int)response.StatusCode, payload)
            };
        }

        using var json = JsonDocument.Parse(payload);
        var usage = json.RootElement.TryGetProperty("usage", out var usageElement) ? usageElement : default;
        var promptTokens = TryGetInt(usage, "input_tokens");
        var completionTokens = TryGetInt(usage, "output_tokens");
        int? totalTokens = null;
        if (promptTokens.HasValue || completionTokens.HasValue)
        {
            totalTokens = (promptTokens ?? 0) + (completionTokens ?? 0);
        }

        var completion = string.Join("\n", json.RootElement
            .GetProperty("content")
            .EnumerateArray()
            .Where(item => item.TryGetProperty("type", out var type) && type.GetString() == "text")
            .Select(item => item.GetProperty("text").GetString())
            .Where(text => !string.IsNullOrWhiteSpace(text)));

        return new LlmHarnessResult
        {
            Succeeded = true,
            Provider = "anthropic",
            Model = _options.Anthropic.Model,
            Completion = completion,
            PromptTokens = promptTokens,
            CompletionTokens = completionTokens,
            TotalTokens = totalTokens
        };
    }

    private static StringContent JsonContent<T>(T payload)
    {
        return new StringContent(JsonSerializer.Serialize(payload, SerializerOptions), Encoding.UTF8, "application/json");
    }

    private static string BuildOpenAiErrorMessage(int statusCode, string payload)
    {
        var (code, message) = ExtractOpenAiError(payload);

        if (statusCode == 429 && string.Equals(code, "insufficient_quota", StringComparison.OrdinalIgnoreCase))
        {
            return "OpenAI API key is valid, but the account/project has no available API quota. Check OpenAI billing and usage limits, then try again.";
        }

        if (statusCode == 401 || string.Equals(code, "invalid_api_key", StringComparison.OrdinalIgnoreCase))
        {
            return "OpenAI authentication failed. Verify this API key is correct and belongs to the intended OpenAI project.";
        }

        if (statusCode == 429)
        {
            return $"OpenAI rate limit reached. {message}";
        }

        if (statusCode == 403)
        {
            return $"OpenAI rejected this request for the selected model/project. {message}";
        }

        return $"OpenAI request failed ({statusCode}). {message}";
    }

    private static string BuildAnthropicErrorMessage(int statusCode, string payload)
    {
        var (type, message) = ExtractAnthropicError(payload);

        if (statusCode == 401 || string.Equals(type, "authentication_error", StringComparison.OrdinalIgnoreCase))
        {
            return "Anthropic authentication failed. Verify this API key is correct and active for your Anthropic account.";
        }

        if (statusCode == 429 || string.Equals(type, "rate_limit_error", StringComparison.OrdinalIgnoreCase))
        {
            return $"Anthropic rate limit reached. {message}";
        }

        if (statusCode == 403)
        {
            return $"Anthropic rejected this request for the selected model/account. {message}";
        }

        return $"Anthropic request failed ({statusCode}). {message}";
    }

    private static int? TryGetInt(JsonElement element, string propertyName)
    {
        if (element.ValueKind != JsonValueKind.Object ||
            !element.TryGetProperty(propertyName, out var value) ||
            value.ValueKind != JsonValueKind.Number)
        {
            return null;
        }

        return value.TryGetInt32(out var parsed) ? parsed : null;
    }

    private static (string Code, string Message) ExtractOpenAiError(string payload)
    {
        try
        {
            using var json = JsonDocument.Parse(payload);
            if (!json.RootElement.TryGetProperty("error", out var error))
            {
                return (string.Empty, "No additional details returned by OpenAI.");
            }

            var code = error.TryGetProperty("code", out var codeProp) ? codeProp.GetString() ?? string.Empty : string.Empty;
            var message = error.TryGetProperty("message", out var messageProp)
                ? messageProp.GetString() ?? "No additional details returned by OpenAI."
                : "No additional details returned by OpenAI.";

            return (code, message);
        }
        catch (JsonException)
        {
            return (string.Empty, "Unable to parse provider error details.");
        }
    }

    private static (string Type, string Message) ExtractAnthropicError(string payload)
    {
        try
        {
            using var json = JsonDocument.Parse(payload);
            if (!json.RootElement.TryGetProperty("error", out var error))
            {
                return (string.Empty, "No additional details returned by Anthropic.");
            }

            var type = error.TryGetProperty("type", out var typeProp) ? typeProp.GetString() ?? string.Empty : string.Empty;
            var message = error.TryGetProperty("message", out var messageProp)
                ? messageProp.GetString() ?? "No additional details returned by Anthropic."
                : "No additional details returned by Anthropic.";

            return (type, message);
        }
        catch (JsonException)
        {
            return (string.Empty, "Unable to parse provider error details.");
        }
    }
}
