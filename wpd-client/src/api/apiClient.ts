import axios from 'axios';
import { useAuth } from '@clerk/clerk-react';

const apiURL = import.meta.env.VITE_API_URL;

const apiClient = axios.create({
  baseURL: apiURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default apiClient;

// Hook-based factory so Clerk token is always fresh
export function useApiClient() {
  const { getToken } = useAuth();

  const client = axios.create({
    baseURL: apiURL,
    headers: { 'Content-Type': 'application/json' },
  });

  client.interceptors.request.use(async (config) => {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        window.location.href = '/';
      }
      return Promise.reject(error);
    }
  );

  return client;
}
