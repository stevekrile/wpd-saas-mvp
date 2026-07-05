import apiClient from './apiClient';
import type { AgencyProfile } from '../types';

export const agencyApi = {
  getAgencyProfile: async (): Promise<AgencyProfile> => {
    const response = await apiClient.get<AgencyProfile>('/api/agency-profile');
    return response.data;
  },

  saveStatementScore: async (
    lensKey: string,
    statementNumber: number,
    score: number
  ): Promise<AgencyProfile> => {
    const response = await apiClient.put<AgencyProfile>(
      `/api/agency-profile/lenses/${lensKey}/statements/${statementNumber}`,
      { score }
    );
    return response.data;
  },
};
