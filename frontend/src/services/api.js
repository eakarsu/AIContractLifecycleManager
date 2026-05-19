import axios from 'axios';
const BACKEND_BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
const api = axios.create({ baseURL: `${BACKEND_BASE}/api` });
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401) { localStorage.removeItem('token'); window.location.href = '/login'; }
  return Promise.reject(err);
});
export default api;
