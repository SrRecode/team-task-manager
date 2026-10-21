export const TASK_STATUSES = ['todo', 'in_progress', 'done'];

export const STATUS_LABELS = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

export function statusLabel(status) {
  return STATUS_LABELS[status] ?? status;
}
