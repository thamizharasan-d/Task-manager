// api.js - small helper for API calls
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const client = axios.create({ baseURL: API_BASE });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function signup({ fullName, email, password, role }) {
  const res = await client.post('/api/auth/signup', { fullName, email, password, role });
  return res.data;
}

export async function login({ email, password, role }) {
  const res = await client.post('/api/auth/login', { email, password, role });
  return res.data;
}

export async function getMe() {
  const res = await client.get('/api/auth/me');
  return res.data;
}

export async function createTask(payload) {
  const res = await client.post('/api/tasks', payload);
  return res.data;
}

export async function getTasks() {
  const res = await client.get('/api/tasks');
  return res.data;
}

export async function getAssignedTasks() {
  const res = await client.get('/api/tasks/assigned');
  return res.data;
}

export async function forgotPassword({ email }) {
  const res = await client.post('/api/auth/forgot-password', { email });
  return res.data;
}

export async function resetPassword({ token, password }) {
  const res = await client.post('/api/auth/reset-password', { token, password });
  return res.data;
}

export default client;
