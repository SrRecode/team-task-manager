import { useCallback, useEffect, useState } from 'react';
import { remindersApi } from '../../api/reminders.api';

const GROUPS = [
  {
    key: 'overdue',
    title: 'Overdue',
    hint: 'The due date has passed',
    tone: 'border-coral/60 bg-coral/20',
    label: 'text-plum-soft',
  },
  {
    key: 'today',
    title: 'Due today',
    hint: 'The due date is today',
    tone: 'border-plum/30 bg-plum/10',
    label: 'text-plum',
  },
  {
    key: 'upcoming',
    title: 'Coming up',
    hint: 'The due date is in the next few days',
    tone: 'border-line bg-paper',
    label: 'text-ink-muted',
  },
];

/**
 * Formats a YYYY-MM-DD date for display. The date is a calendar date without
 * a time zone, so it is read in UTC to keep the day the user entered.
 */
function formatDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/**
 * The due-date reminders of the signed in user (BONUS-01).
 *
 * The reminder is shown in the app only: there is no mail server in this
 * build, so nothing is sent by email.
 */
export default function ReminderPanel({ refreshToken = 0 }) {
  const [reminders, setReminders] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReminders = useCallback(() => {
    return remindersApi
      .list()
      .then((payload) => {
        setReminders(payload.data.reminders);
        setError('');
      })
      .catch((requestError) => {
        setError(requestError.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadReminders();
  }, [loadReminders, refreshToken]);

  if (loading) {
    return (
      <section className="mt-6 rounded-xl border border-line bg-surface p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Reminders
        </h3>
        <p className="mt-3 text-sm text-ink-muted">Checking your due dates…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mt-6 rounded-xl border border-line bg-surface p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Reminders
        </h3>
        <p role="alert" className="mt-3 text-sm text-coral">
          {error}
        </p>
      </section>
    );
  }

  const total = reminders?.counts.total ?? 0;

  return (
    <section className="mt-6 rounded-xl border border-line bg-surface p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Reminders
        </h3>
        <p className="text-xs text-ink-muted">
          {total === 0
            ? `Nothing of yours is due in the next ${reminders?.windowDays ?? 7} days`
            : `${total} task${total === 1 ? '' : 's'} of yours ${total === 1 ? 'needs' : 'need'} attention`}
        </p>
      </div>

      {total === 0 ? null : (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {GROUPS.map((group) => {
            const tasks = reminders.reminders[group.key] ?? [];

            if (tasks.length === 0) return null;

            return (
              <div key={group.key} className={`rounded-lg border p-4 ${group.tone}`}>
                <p className={`text-xs font-semibold uppercase tracking-wide ${group.label}`}>
                  {group.title}
                </p>
                <p className="mt-1 text-xs text-ink-muted">{group.hint}</p>

                <ul className="mt-3 space-y-3">
                  {tasks.map((task) => (
                    <li key={task.id}>
                      <p className="text-sm font-medium text-ink">{task.title}</p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {task.teamName ? `${task.teamName} · ` : ''}Due{' '}
                        {formatDate(task.dueDate)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
