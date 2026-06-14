import apiClient from './apiClient';
import type { WpdUser } from '../types';

export const authApi = {
  getWpdUser: async (): Promise<WpdUser> => {
    const response = await apiClient.get<WpdUser>('/auth/me');
    return response.data;
  },

  provisionWpdUser: async (email: string, displayName: string): Promise<WpdUser> => {
    const response = await apiClient.post<WpdUser>('/auth/provision', { email, displayName });
    return response.data;
  },
};