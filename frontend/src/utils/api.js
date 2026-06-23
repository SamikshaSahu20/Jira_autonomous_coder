import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const login = async (username, password) => {
  const params = new URLSearchParams();
  params.append('username', username);
  params.append('password', password);
  
  const response = await api.post('/login', params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  return response.data;
};

export const getTickets = async () => {
  const response = await api.get('/tickets');
  return response.data;
};

export const getTicketFiles = async (ticketKey) => {
  const response = await api.get(`/tickets/${ticketKey}/files`);
  return response.data;
};

export const runTicketApp = async (ticketKey) => {
  const response = await api.post(`/tickets/${ticketKey}/run`);
  return response.data;
};

export default api;