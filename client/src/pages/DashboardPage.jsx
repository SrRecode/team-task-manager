import { useCallback, useEffect, useMemo, useState } from 'react';
import AppShell from '../components/layout/AppShell';
import ReminderPanel from '../components/reminders/ReminderPanel';
import TaskFilters from '../components/tasks/TaskFilters';
import TaskList from '../components/tasks/TaskList';
import TaskModal from '../components/tasks/TaskModal';
import { tasksApi } from '../api/tasks.api';
import { teamsApi } from '../api/teams.api';
import { useAuth } from '../context/useAuth';

const EMPTY_FILTERS = { teamId: '', assigneeId: '', status: '', search: '' };

/**
 * Merges the member lists of several teams into one list of people.
 */
function mergeMembers(lists) {
  const byUser = new Map();

  for (const list of lists) {
    for (const member of list) {
      byUser.set(member.userId, member);
    }
  }

  return [...byUser.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export default function DashboardPage() {
  const { user } = useAuth();

  const [teams, setTeams] = useState([]);
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [teamsError, setTeamsError] = useState('');
  const [tasksError, setTasksError] = useState('');
  const [actionError, setActionError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskVersion, setTaskVersion] = useState(0);

  const { teamId, assigneeId, status, search } = filters;

  const loadTeams = useCallback(() => {
    return teamsApi
      .list()
      .then((payload) => {
        const list = payload.data.teams;
        setTeams(list);
        setTeamsError('');
        return Promise.all(
          list.map((team) =>
            teamsApi
              .listMembers(team.id)
              .then((memberPayload) => memberPayload.data.members)
              .catch(() => [])
          )
        );
      })
      .then((memberLists) => {
        setMembers(mergeMembers(memberLists));
      })
      .catch((error) => {
        setTeamsError(error.message);
      })
      .finally(() => {
        setTeamsLoading(false);
      });
  }, []);

  const loadTasks = useCallback(() => {
    setTasksLoading(true);
    return tasksApi
      .list({ teamId, assigneeId, status, search })
      .then((payload) => {
        setTasks(payload.data.tasks);
        setTasksError('');
      })
      .catch((error) => {
        setTasksError(error.message);
      })
      .finally(() => {
        setTasksLoading(false);
      });
  }, [teamId, assigneeId, status, search]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadTasks();
    }, search ? 300 : 0);

    return () => clearTimeout(timer);
  }, [loadTasks, search]);

  const hasFilters = useMemo(
    () => Boolean(teamId || assigneeId || status || search),
    [teamId, assigneeId, status, search]
  );

  function openCreateModal() {
    setActionError('');
    setEditingTask(null);
    setModalOpen(true);
  }

  function openEditModal(task) {
    setActionError('');
    setEditingTask(task);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingTask(null);
  }

  function handleSaved() {
    closeModal();
    loadTasks().then(() => setTaskVersion((version) => version + 1));
  }

  async function handleDelete(task) {
    setActionError('');
    try {
      await tasksApi.remove(task.id);
      await loadTasks();
      setTaskVersion((version) => version + 1);
    } catch (error) {
      setActionError(error.message);
    }
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">Dashboard</h2>
          <p className="mt-1 text-sm text-ink-muted">
            The tasks of every team you belong to, with the filters you need.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          disabled={teams.length === 0}
          className="rounded-lg bg-plum px-4 py-2 text-sm font-semibold text-paper transition hover:bg-plum-soft disabled:cursor-not-allowed disabled:opacity-60"
        >
          New task
        </button>
      </div>

      {teams.length === 0 && !teamsLoading ? (
        <p className="mt-4 rounded-xl border border-dashed border-line bg-surface px-4 py-6 text-center text-sm text-ink-muted">
          You do not belong to a team yet, so there is nowhere to put a task.{' '}
          <a href="/teams" className="font-semibold text-plum underline underline-offset-4">
            Create a team
          </a>{' '}
          first.
        </p>
      ) : null}

      <div className="mt-6">
        <TaskFilters
          filters={filters}
          onChange={setFilters}
          teams={teams}
          members={members}
          onClear={() => setFilters(EMPTY_FILTERS)}
        />
      </div>

      <ReminderPanel refreshToken={taskVersion} />

      {teamsError ? (
        <p role="alert" className="mt-4 text-sm text-coral">
          {teamsError}
        </p>
      ) : null}

      {actionError ? (
        <p role="alert" className="mt-4 text-sm text-coral">
          {actionError}
        </p>
      ) : null}

      <section className="mt-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Tasks</h3>

        <div className="mt-3">
          {tasksLoading ? (
            <p className="rounded-xl border border-line bg-surface px-4 py-10 text-center text-sm text-ink-muted">
              Loading your tasks…
            </p>
          ) : tasksError ? (
            <p role="alert" className="rounded-xl border border-line bg-surface px-4 py-10 text-center text-sm text-coral">
              {tasksError}
            </p>
          ) : (
            <TaskList
              tasks={tasks}
              teams={teams}
              currentUserId={user?.id}
              filtered={hasFilters}
              onEdit={openEditModal}
              onDelete={handleDelete}
            />
          )}
        </div>
      </section>

      {modalOpen ? (
        <TaskModal
          key={editingTask ? `edit-${editingTask.id}` : 'create'}
          task={editingTask}
          teams={teams}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      ) : null}
    </AppShell>
  );
}
