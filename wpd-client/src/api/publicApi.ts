import apiClient from './apiClient';
import type { PublicLens, LandingContent } from '../types';

export const publicApi = {
  getLenses: async (): Promise<PublicLens[]> => {
    const response = await apiClient.get<PublicLens[]>('/public/lenses');
    return response.data;
  },

  getLandingContent: async (): Promise<LandingContent> => {
    const response = await apiClient.get<LandingContent>('/public/content/landing');
    return response.data;
  },
};
