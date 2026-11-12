import axios from 'axios';

let apiBase = import.meta.env.VITE_API_URL || '/api';
if (typeof window !== 'undefined' && window.location?.hostname && window.location.hostname !== 'localhost') {
  if (apiBase.includes('localhost:5000')) {
    apiBase = `${window.location.protocol}//${window.location.hostname}:5000/api`;
  }
}

const api = axios.create({
  baseURL: apiBase,
  timeout: 15000, // 15-second timeout prevents indefinite hangs
});

api.interceptors.request.use((config) => {
  const stored = localStorage.getItem('hotelStockAuth');
  if (stored) {
    const { token } = JSON.parse(stored);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('hotelStockAuth');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
