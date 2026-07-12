import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { llmCredentialApi } from '../../api/llmCredentialApi';
import type { LlmProvider } from '../../api/processApi';

function getErrorMessage(error: unknown, fallback: string): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: unknown }).response === 'object' &&
    (error as { response?: unknown }).response !== null
  ) {
    const response = (error as { response: { data?: unknown } }).response;
    const data = response.data;
    if (typeof data === 'object' && data !== null && 'error' in data && typeof (data as { error?: unknown }).error === 'string') {
      return (data as { error: string }).error;
    }
  }

  return error instanceof Error ? error.message : fallback;
}

export default function SettingsAiAccountsPage() {
  const queryClient = useQueryClient();
  const successTimersRef = useRef<Partial<Record<LlmProvider, ReturnType<typeof setTimeout>>>>({});
  const [credentialInputs, setCredentialInputs] = useState<Record<LlmProvider, string>>({
    openai: '',
    anthropic: '',
  });
  const [testFeedback, setTestFeedback] = useState<Partial<Record<LlmProvider, { kind: 'success' | 'error'; message: string }>>>({});
  const [testingProviders, setTestingProviders] = useState<Partial<Record<LlmProvider, boolean>>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const timerMap = successTimersRef.current;
    return () => {
      for (const provider of ['openai', 'anthropic'] as LlmProvider[]) {
        const timer = timerMap[provider];
        if (timer) {
          clearTimeout(timer);
        }
      }
    };
  }, []);

  const { data: credentialStatuses = [], isLoading } = useQuery({
    queryKey: ['llm-credentials'],
    queryFn: llmCredentialApi.getStatuses,
  });

  const saveCredentialMutation = useMutation({
    mutationFn: async (provider: LlmProvider) => {
      return llmCredentialApi.saveCredential(provider, credentialInputs[provider]);
    },
    onSuccess: async (_, provider) => {
      setCredentialInputs((prev) => ({ ...prev, [provider]: '' }));
      setTestFeedback((prev) => ({ ...prev, [provider]: undefined }));
      setErrorMessage(null);
      setFeedback(null);
      await queryClient.invalidateQueries({ queryKey: ['llm-credentials'] });
      await runProviderTest(provider);
    },
    onError: (error) => {
      setFeedback(null);
      setErrorMessage(getErrorMessage(error, 'Failed to save key.'));
    },
  });

  const removeCredentialMutation = useMutation({
    mutationFn: async (provider: LlmProvider) => {
      return llmCredentialApi.removeCredential(provider);
    },
    onSuccess: async (_, provider) => {
      const timer = successTimersRef.current[provider];
      if (timer) {
        clearTimeout(timer);
        successTimersRef.current[provider] = undefined;
      }
      setTestFeedback((prev) => ({ ...prev, [provider]: undefined }));
      setTestingProviders((prev) => ({ ...prev, [provider]: false }));
      setErrorMessage(null);
      setFeedback(`${provider === 'openai' ? 'OpenAI' : 'Anthropic'} key removed.`);
      await queryClient.invalidateQueries({ queryKey: ['llm-credentials'] });
    },
    onError: (error) => {
      setFeedback(null);
      setErrorMessage(getErrorMessage(error, 'Failed to remove key.'));
    },
  });

  const testCredentialMutation = useMutation({
    mutationFn: async (provider: LlmProvider) => {
      return llmCredentialApi.testCredential(provider);
    },
  });

  async function runProviderTest(provider: LlmProvider) {
    const timer = successTimersRef.current[provider];
    if (timer) {
      clearTimeout(timer);
      successTimersRef.current[provider] = undefined;
    }

    setTestingProviders((prev) => ({ ...prev, [provider]: true }));
    setTestFeedback((prev) => ({ ...prev, [provider]: undefined }));

    try {
      await testCredentialMutation.mutateAsync(provider);
      setTestFeedback((prev) => ({
        ...prev,
        [provider]: {
          kind: 'success',
          message: `${provider === 'openai' ? 'OpenAI' : 'Anthropic'} connection succeeded.`,
        },
      }));
      successTimersRef.current[provider] = setTimeout(() => {
        setTestFeedback((prev) => (prev[provider]?.kind === 'success' ? { ...prev, [provider]: undefined } : prev));
        successTimersRef.current[provider] = undefined;
      }, 5000);
      setErrorMessage(null);
    } catch (error) {
      setTestFeedback((prev) => ({
        ...prev,
        [provider]: {
          kind: 'error',
          message: getErrorMessage(error, 'Failed to test key.'),
        },
      }));
    } finally {
      setTestingProviders((prev) => ({ ...prev, [provider]: false }));
    }
  }

  return (
    <div className="diagnostic-page-v2 settings-ai-accounts-page">
      <div className="diagnostic-page-header">
        <h1>Settings · AI Accounts</h1>
        <p>Connect your own LLM provider keys. Credentials are encrypted server-side and used only for your requests.</p>
      </div>

      <div className="diagnostic-card">
        {isLoading && <p className="summary-prompt-warning">Loading account status...</p>}
        <div className="llm-credential-list">
          {(['openai', 'anthropic'] as LlmProvider[]).map((provider) => {
            const providerName = provider === 'openai' ? 'OpenAI' : 'Anthropic';
            const status = credentialStatuses.find((entry) => entry.provider === provider);
            const isConfigured = Boolean(status?.isConfigured);
            const providerTestFeedback = testFeedback[provider];
            const isProviderTesting = Boolean(testingProviders[provider]);
            const isBusy = saveCredentialMutation.isPending || removeCredentialMutation.isPending || isProviderTesting;

            return (
              <div className="llm-credential-card" key={provider}>
                <div className="llm-credential-card-header">
                  <strong>{providerName}</strong>
                  <span className={isConfigured ? 'llm-connected' : 'llm-not-connected'}>
                    {isConfigured ? `Connected ${status?.keyHint ? `(${status.keyHint})` : ''}` : 'Not connected'}
                  </span>
                </div>
                {isConfigured ? (
                  <>
                    <div className="diagnostic-actions">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => void runProviderTest(provider)}
                        disabled={isBusy}
                      >
                        Test
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => removeCredentialMutation.mutate(provider)}
                        disabled={isBusy}
                      >
                        Remove
                      </button>
                    </div>
                    {isProviderTesting && <p className="summary-prompt-warning">Testing connection...</p>}
                    {!isProviderTesting && providerTestFeedback?.kind === 'success' && (
                      <p className="summary-prompt-warning">{providerTestFeedback.message}</p>
                    )}
                    {!isProviderTesting && providerTestFeedback?.kind === 'error' && (
                      <>
                        <div className="error-message">{providerTestFeedback.message}</div>
                        <div className="diagnostic-actions">
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setTestFeedback((prev) => ({ ...prev, [provider]: undefined }))}
                            disabled={isBusy}
                          >
                            Clear
                          </button>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <input
                      type="password"
                      value={credentialInputs[provider]}
                      onChange={(e) => setCredentialInputs((prev) => ({ ...prev, [provider]: e.target.value }))}
                      placeholder={`Paste ${providerName} API key`}
                    />
                    <div className="diagnostic-actions">
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => saveCredentialMutation.mutate(provider)}
                        disabled={isBusy || !credentialInputs[provider].trim()}
                      >
                        Save Key
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
        {feedback && <p className="summary-prompt-warning">{feedback}</p>}
        {errorMessage && <div className="error-message">{errorMessage}</div>}
      </div>
    </div>
  );
}
