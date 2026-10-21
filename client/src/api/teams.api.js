import { request } from './http';

export const teamsApi = {
  list: () => request('/teams'),

  create: (team) => request('/teams', { method: 'POST', body: JSON.stringify(team) }),

  get: (teamId) => request(`/teams/${teamId}`),

  update: (teamId, changes) =>
    request(`/teams/${teamId}`, { method: 'PATCH', body: JSON.stringify(changes) }),

  remove: (teamId) => request(`/teams/${teamId}`, { method: 'DELETE' }),

  listMembers: (teamId) => request(`/teams/${teamId}/members`),

  addMember: (teamId, email) =>
    request(`/teams/${teamId}/members`, { method: 'POST', body: JSON.stringify({ email }) }),

  removeMember: (teamId, userId) => request(`/teams/${teamId}/members/${userId}`, { method: 'DELETE' }),
};
