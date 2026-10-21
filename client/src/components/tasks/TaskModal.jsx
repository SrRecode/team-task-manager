import { useEffect, useState } from 'react';
import { tasksApi } from '../../api/tasks.api';
import { teamsApi } from '../../api/teams.api';
import { TASK_STATUSES, statusLabel } from './taskStatus';

const inputClass =
  'mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum';

const labelClass = 'block text-sm font-medium text-ink';

/**
 * The create and edit dialog for a task.
 *
 * The component is mounted only while the dialog is open, so the form starts
 * from the task it edits. The same form serves both modes: `task` is null
 * when a new task is created.
 */
export default function TaskModal({ task, teams, onClose, onSaved }) {
  const isEdit = Boolean(task);

  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [teamId, setTeamId] = useState(() => String(task?.teamId ?? teams[0]?.id ?? ''));
  const [assignedTo, setAssignedTo] = useState(() =>
    task?.assignedTo ? String(task.assignedTo) : ''
  );
  const [status, setStatus] = useState(task?.status ?? 'todo');
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '');
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  // The members of the selected team are the only possible assignees.
  useEffect(() => {
    if (!teamId) return undefined;

    let cancelled = false;

    teamsApi
      .listMembers(teamId)
      .then((payload) => {
        if (cancelled) return;
        setMembers(payload.data.members);
      })
      .catch((requestError) => {
        if (cancelled) return;
        setError(requestError.message);
      });

    return () => {
      cancelled = true;
    };
  }, [teamId]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function handleTeamChange(event) {
    const nextTeamId = event.target.value;
    setTeamId(nextTeamId);
    setAssignedTo('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setPending(true);

    const payload = {
      title: title.trim(),
      description: description.trim(),
      status,
      dueDate: dueDate || null,
      assignedTo: assignedTo ? Number(assignedTo) : null,
    };

    try {
      if (isEdit) {
        await tasksApi.update(task.id, payload);
      } else {
        await tasksApi.create({ ...payload, teamId: Number(teamId) });
      }
      onSaved();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-modal-title"
        className="w-full max-w-lg rounded-xl border border-line bg-surface p-6 shadow-lg"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="task-modal-title" className="text-xl font-semibold tracking-tight text-ink">
            {isEdit ? 'Edit task' : 'New task'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the task dialog"
            className="rounded-lg border border-line bg-paper px-2 py-1 text-sm text-ink-muted transition hover:bg-coral/20"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
          <div>
            <label htmlFor="task-title" className={labelClass}>
              Title
            </label>
            <input
              id="task-title"
              name="title"
              type="text"
              required
              maxLength={200}
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="task-description" className={labelClass}>
              Description
            </label>
            <textarea
              id="task-description"
              name="description"
              rows={3}
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className={inputClass}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="task-team" className={labelClass}>
                Team
              </label>
              <select
                id="task-team"
                name="teamId"
                required
                value={teamId}
                onChange={handleTeamChange}
                disabled={isEdit}
                className={inputClass}
              >
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              {isEdit ? (
                <p className="mt-1 text-xs text-ink-muted">A task always stays in its team.</p>
              ) : null}
            </div>

            <div>
              <label htmlFor="task-assignee" className={labelClass}>
                Assignee
              </label>
              <select
                id="task-assignee"
                name="assignedTo"
                value={assignedTo}
                onChange={(event) => setAssignedTo(event.target.value)}
                className={inputClass}
              >
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="task-status" className={labelClass}>
                Status
              </label>
              <select
                id="task-status"
                name="status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className={inputClass}
              >
                {TASK_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {statusLabel(value)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="task-due-date" className={labelClass}>
                Due date
              </label>
              <input
                id="task-due-date"
                name="dueDate"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {error ? (
            <p role="alert" className="rounded-lg border border-coral/40 bg-coral/10 px-3 py-2 text-sm text-plum">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-line bg-paper px-4 py-2 text-sm font-semibold text-ink transition hover:bg-coral/20"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-plum px-4 py-2 text-sm font-semibold text-paper transition hover:bg-plum-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
