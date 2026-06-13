import axios from 'axios';

const apiURL = import.meta.env.VITE_API_URL;
console.log('Creating axios with baseURL:', apiURL);

const apiClient = axios.create({
  baseURL: apiURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

console.log('API URL:', import.meta.env.VITE_API_URL);

// Add token to requests if it exists
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors (unauthorized)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;