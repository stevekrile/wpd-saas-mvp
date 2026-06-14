import axios from 'axios';

const apiURL = import.meta.env.VITE_API_URL;

const apiClient = axios.create({
  baseURL: apiURL,
  headers: { 'Content-Type': 'application/json' },
});

// Called once from WpdAuthProvider with Clerk's getToken function
export function configureApiAuth(getToken: () => Promise<string | null>) {
  apiClient.interceptors.request.use(async (config) => {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        window.location.href = '/';
      }
      return Promise.reject(error);
    }
  );
}

export default apiClient;
