import { request } from './http';

/**
 * Builds the query string of the task filters. Empty filters are left out so
 * that the API receives a clean request.
 */
function toQuery(filters) {
  const params = new URLSearchParams();

  if (filters.teamId) params.set('teamId', filters.teamId);
  if (filters.assigneeId) params.set('assigneeId', filters.assigneeId);
  if (filters.status) params.set('status', filters.status);
  if (filters.search) params.set('search', filters.search);

  const query = params.toString();
  return query ? `?${query}` : '';
}

export const tasksApi = {
  list: (filters = {}) => request(`/tasks${toQuery(filters)}`),

  create: (task) => request('/tasks', { method: 'POST', body: JSON.stringify(task) }),

  get: (taskId) => request(`/tasks/${taskId}`),

  update: (taskId, changes) =>
    request(`/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(changes) }),

  remove: (taskId) => request(`/tasks/${taskId}`, { method: 'DELETE' }),
};
