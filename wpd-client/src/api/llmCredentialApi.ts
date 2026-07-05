import apiClient from './apiClient';
import type { LlmProvider } from './processApi';

export interface LlmCredentialStatus {
  provider: LlmProvider;
  isConfigured: boolean;
  keyHint: string;
  updatedAt?: string;
}

export const llmCredentialApi = {
  getStatuses: async (): Promise<LlmCredentialStatus[]> => {
    const response = await apiClient.get<LlmCredentialStatus[]>('/api/llm-credentials');
    return response.data;
  },

  saveCredential: async (provider: LlmProvider, apiKey: string): Promise<void> => {
    await apiClient.put(`/api/llm-credentials/${provider}`, { apiKey });
  },

  removeCredential: async (provider: LlmProvider): Promise<void> => {
    await apiClient.delete(`/api/llm-credentials/${provider}`);
  },

  testCredential: async (provider: LlmProvider): Promise<void> => {
    await apiClient.post(`/api/llm-credentials/${provider}/test`);
  },
};
