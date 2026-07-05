import apiClient from './apiClient';

export interface DiagnosticResponseData {
  questionId: number;
  numericResponse: number;
  textResponse: string;
  answeredAt?: string;
}

export interface LoadDiagnosticResponse {
  diagnosticId: number;
  processId: number;
  status: string;
  questions: DiagnosticResponseData[];
  lensNotes: DiagnosticLensNoteData[];
}

export interface SaveDiagnosticResponseRequest {
  numericResponse: number;
  textResponse: string;
}

export interface DiagnosticLensNoteData {
  lensKey: string;
  noteText: string;
  updatedAt?: string;
}

export interface SaveDiagnosticLensNoteRequest {
  noteText: string;
}

export type LlmProvider = 'openai' | 'anthropic';

export interface SendLlmHarnessRequest {
  provider: LlmProvider;
  prompt: string;
}

export interface SendLlmHarnessResponse {
  provider: string;
  model: string;
  completion: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface SaveDiagnosticLlmResultRequest {
  resultMarkdown: string;
  provider?: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface GetDiagnosticLlmResultResponse {
  resultMarkdown: string;
  provider: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface DiagnosticLlmResultHistoryItem {
  id: number;
  resultMarkdown: string;
  provider: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  createdAt: string;
}

export interface GetDiagnosticLlmResultHistoryResponse {
  items: DiagnosticLlmResultHistoryItem[];
}

export interface Process {
  id: number;
  name: string;
  description: string;
  problemStatement: string;
  context: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  workspaceId: number;
}

export interface CreateProcessRequest {
  name: string;
  description: string;
  problemStatement: string;
  context: string;
}

export const processApi = {
  getProcess: async (processId: number): Promise<Process> => {
    const response = await apiClient.get<Process>(`/api/processes/${processId}`);
    return response.data;
  },

  getProcesses: async (): Promise<Process[]> => {
    const response = await apiClient.get<Process[]>('/api/processes');
    return response.data;
  },

  createProcess: async (request: CreateProcessRequest) => {
    const response = await apiClient.post('/api/processes', request);
    return response.data;
  },

  updateProcess: async (processId: number, request: CreateProcessRequest) => {
    await apiClient.put(`/api/processes/${processId}`, request);
  },

  deleteProcess: async (processId: number) => {
    await apiClient.delete(`/api/processes/${processId}`);
  },

  checkTierLimit: async () => {
    const response = await apiClient.get('/api/processes/tier-limit');
    return response.data;
  },

  loadDiagnostic: async (processId: number): Promise<LoadDiagnosticResponse> => {
    const response = await apiClient.get<LoadDiagnosticResponse>(`/api/diagnostics/${processId}`);
    return response.data;
  },

  saveDiagnosticResponse: async (
    processId: number,
    questionId: number,
    request: SaveDiagnosticResponseRequest
  ): Promise<void> => {
    await apiClient.put(`/api/diagnostics/${processId}/questions/${questionId}`, request);
  },

  saveDiagnosticLensNote: async (
    processId: number,
    lensKey: string,
    request: SaveDiagnosticLensNoteRequest
  ): Promise<void> => {
    await apiClient.put(`/api/diagnostics/${processId}/lenses/${lensKey}/notes`, request);
  },

  sendLlmHarnessPrompt: async (
    processId: number,
    request: SendLlmHarnessRequest
  ): Promise<SendLlmHarnessResponse> => {
    const response = await apiClient.post<SendLlmHarnessResponse>(`/api/diagnostics/${processId}/llm-harness`, request);
    return response.data;
  },

  getDiagnosticLlmResult: async (processId: number): Promise<GetDiagnosticLlmResultResponse> => {
    const response = await apiClient.get<GetDiagnosticLlmResultResponse>(`/api/diagnostics/${processId}/llm-result`);
    return response.data;
  },

  getDiagnosticLlmResultHistory: async (processId: number): Promise<GetDiagnosticLlmResultHistoryResponse> => {
    const response = await apiClient.get<GetDiagnosticLlmResultHistoryResponse>(`/api/diagnostics/${processId}/llm-result-history`);
    return response.data;
  },

  deleteDiagnosticLlmResultHistoryItem: async (processId: number, historyItemId: number): Promise<void> => {
    await apiClient.delete(`/api/diagnostics/${processId}/llm-result-history/${historyItemId}`);
  },

  saveDiagnosticLlmResult: async (
    processId: number,
    request: SaveDiagnosticLlmResultRequest
  ): Promise<void> => {
    await apiClient.put(`/api/diagnostics/${processId}/llm-result`, request);
  },
};
