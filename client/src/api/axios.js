import axios from 'axios';

let apiBase = import.meta.env.VITE_API_URL || '/api';

// On any non-localhost domain (cloud hosting like Aletcloud, Render, VPS),
// frontend and backend are reverse-proxied together under standard HTTPS.
// Never append ':5000' or route to localhost; always use relative '/api'.
if (typeof window !== 'undefined' && window.location?.hostname) {
  const host = window.location.hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') {
    if (!apiBase || apiBase.includes('localhost') || apiBase.includes(':5000')) {
      apiBase = '/api';
    }
  }
}

const api = axios.create({
  baseURL: apiBase,
  timeout: 60000, // 60-second default timeout for stable operations
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
