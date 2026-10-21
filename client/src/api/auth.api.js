import { request } from './http';

export const authApi = {
  register: (details) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(details) }),

  login: (credentials) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),

  logout: () => request('/auth/logout', { method: 'POST' }),

  me: () => request('/auth/me'),
};
