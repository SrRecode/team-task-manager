import { request } from './http';

export const remindersApi = {
  list: () => request('/reminders'),
};
