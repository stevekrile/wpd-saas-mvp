import apiClient from './apiClient';

interface RogueBrickProgressResponse {
  progressJson: string;
  updatedAtEpochMs: number;
}

export const rogueBrickApi = {
  getProgress: async (): Promise<RogueBrickProgressResponse> => {
    const response = await apiClient.get<RogueBrickProgressResponse>('/api/rogue-brick/progress');
    return response.data;
  },

  saveProgress: async (progressJson: string): Promise<RogueBrickProgressResponse> => {
    const response = await apiClient.put<RogueBrickProgressResponse>('/api/rogue-brick/progress', {
      progressJson,
    });
    return response.data;
  },
};
