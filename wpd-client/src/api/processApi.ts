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
};
