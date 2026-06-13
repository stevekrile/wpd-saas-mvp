import apiClient from './apiClient';
import type { Process, CreateProcessRequest } from '../types';

export const processApi = {
  getProcesses: async (): Promise<Process[]> => {
    const response = await apiClient.get<Process[]>('/processes');
    return response.data;
  },

  getProcess: async (id: number): Promise<Process> => {
    const response = await apiClient.get<Process>(`/processes/${id}`);
    return response.data;
  },

  createProcess: async (data: CreateProcessRequest): Promise<Process> => {
    const response = await apiClient.post<Process>('/processes', data);
    return response.data;
  },

  updateProcess: async (id: number, data: Partial<CreateProcessRequest> & { status?: string }): Promise<void> => {
    await apiClient.put(`/processes/${id}`, data);
  },

  deleteProcess: async (id: number): Promise<void> => {
    await apiClient.delete(`/processes/${id}`);
  },

  checkTierLimit: async (): Promise<{
    canCreate: boolean;
    currentCount: number;
    maxAllowed: string;
    tierName: string;
  }> => {
    const response = await apiClient.get('/processes/tier-limit');
    return response.data;
  },
};