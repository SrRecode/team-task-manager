import { useState } from 'react';
import { statusLabel } from './taskStatus';

const STATUS_STYLES = {
  todo: 'border border-line bg-paper text-ink-muted',
  in_progress: 'border border-plum/30 bg-plum/10 text-plum',
  done: 'border border-plum/30 bg-plum text-paper',
};

/**
 * The list of tasks, one row per task.
 *
 * The actions are only rendered for the members who may change the task. The
 * server enforces the same rule, so hiding the buttons is a convenience and
 * never the protection.
 */
export default function TaskList({
  tasks,
  teams,
  currentUserId,
  filtered,
  onEdit,
  onDelete,
}) {
  const [confirmingId, setConfirmingId] = useState(null);

  const teamName = (teamId) => teams.find((team) => team.id === teamId)?.name ?? 'Unknown team';

  const canEdit = (task) =>
    task.currentUserRole === 'owner' || Number(task.createdBy) === Number(currentUserId);

  if (tasks.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-surface px-4 py-10 text-center text-sm text-ink-muted">
        {filtered
          ? 'No task matches these filters. Clear the filters to see the rest.'
          : 'No task yet. Create the first task of your team to get started.'}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
      {tasks.map((task) => (
        <li key={task.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">{task.title}</p>
            {task.description ? (
              <p className="mt-1 max-w-prose text-sm text-ink-muted">{task.description}</p>
            ) : null}
            <p className="mt-1 text-xs text-ink-muted">
              {teamName(task.teamId)}
              {' · '}
              {task.assignedToName ? `Assigned to ${task.assignedToName}` : 'Unassigned'}
              {task.dueDate ? ` · Due ${task.dueDate}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                STATUS_STYLES[task.status] ?? STATUS_STYLES.todo
              }`}
            >
              {statusLabel(task.status)}
            </span>

            {canEdit(task) ? (
              confirmingId === task.id ? (
                <span className="flex items-center gap-2 text-xs text-ink-muted">
                  Delete this task?
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingId(null);
                      onDelete(task);
                    }}
                    className="font-semibold text-plum underline underline-offset-4 hover:text-coral"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(null)}
                    className="font-semibold text-plum underline underline-offset-4 hover:text-coral"
                  >
                    No
                  </button>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onEdit(task)}
                    className="text-xs font-medium text-plum-soft underline underline-offset-4 hover:text-coral"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(task.id)}
                    className="text-xs font-medium text-plum-soft underline underline-offset-4 hover:text-coral"
                  >
                    Delete
                  </button>
                </span>
              )
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
