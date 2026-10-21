import { useCallback, useEffect, useState } from 'react';
import AppShell from '../components/layout/AppShell';
import TeamPanel from '../components/teams/TeamPanel';
import { teamsApi } from '../api/teams.api';
import { useAuth } from '../context/useAuth';

export default function TeamsPage() {
  const { user } = useAuth();

  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [createError, setCreateError] = useState('');
  const [createPending, setCreatePending] = useState(false);

  const loadTeams = useCallback(() => {
    return teamsApi
      .list()
      .then((payload) => {
        setTeams(payload.data.teams);
        setLoadError('');
      })
      .catch((error) => {
        setLoadError(error.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  async function handleCreate(event) {
    event.preventDefault();
    setCreateError('');
    setCreatePending(true);
    try {
      const payload = await teamsApi.create({ name, description });
      setName('');
      setDescription('');
      await loadTeams();
      setSelectedId(payload.data.team.id);
    } catch (error) {
      setCreateError(error.message);
    } finally {
      setCreatePending(false);
    }
  }

  const selectedTeam = teams.find((team) => team.id === selectedId) ?? null;

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">Your teams</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Teams group the people and the tasks that belong together.
          </p>
        </div>
      </div>

      <section className="mt-8 rounded-xl border border-line bg-surface p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Create a team
        </h3>
        <form onSubmit={handleCreate} className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="new-team-name" className="block text-sm font-medium text-ink">
              Team name
            </label>
            <input
              id="new-team-name"
              name="name"
              type="text"
              required
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
            />
          </div>
          <div>
            <label htmlFor="new-team-description" className="block text-sm font-medium text-ink">
              Description
            </label>
            <input
              id="new-team-description"
              name="description"
              type="text"
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={createPending}
              className="rounded-lg bg-plum px-4 py-2 text-sm font-semibold text-paper transition hover:bg-plum-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              {createPending ? 'Creating…' : 'Create team'}
            </button>
          </div>
        </form>
        {createError ? (
          <p role="alert" className="mt-3 text-sm text-coral">
            {createError}
          </p>
        ) : null}
      </section>

      <section className="mt-8">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Teams you belong to
        </h3>

        {loading ? (
          <p className="mt-3 text-sm text-ink-muted">Loading your teams…</p>
        ) : loadError ? (
          <p role="alert" className="mt-3 text-sm text-coral">
            {loadError}
          </p>
        ) : teams.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-line bg-surface px-4 py-8 text-center text-sm text-ink-muted">
            You do not belong to any team yet. Create one above to get started.
          </p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {teams.map((team) => (
              <li key={team.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(team.id)}
                  aria-pressed={selectedId === team.id}
                  className={
                    selectedId === team.id
                      ? 'w-full rounded-xl border border-plum bg-surface p-4 text-left transition'
                      : 'w-full rounded-xl border border-line bg-surface p-4 text-left transition hover:border-plum-soft'
                  }
                >
                  <p className="text-sm font-semibold text-ink">{team.name}</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {team.description || 'No description yet.'}
                  </p>
                  <p className="mt-2 text-xs font-medium uppercase tracking-wide text-plum-soft">
                    {team.currentUserRole === 'owner' ? 'You are the owner' : 'You are a member'}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectedTeam ? (
        <div className="mt-8">
          <TeamPanel
            key={selectedTeam.id}
            team={selectedTeam}
            currentUserId={user?.id}
            onChanged={loadTeams}
            onDeleted={async () => {
              setSelectedId(null);
              await loadTeams();
            }}
          />
        </div>
      ) : null}
    </AppShell>
  );
}
