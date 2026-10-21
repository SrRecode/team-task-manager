import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export default function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-plum-soft">
              Glacier Agency
            </p>
            <h1 className="text-lg font-semibold text-ink">Team Task Manager</h1>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-ink-muted">{user?.name}</span>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-coral/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-xl border border-line bg-surface p-8">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            Welcome, {user?.name}
          </h2>
          <p className="mt-2 max-w-prose text-sm text-ink-muted">
            Your account is ready. Teams, team members and tasks are being added in the next
            milestone, so this dashboard is intentionally empty for now.
          </p>
          <p className="mt-6 text-sm text-ink-muted">
            <Link to="/register" className="font-semibold text-plum underline underline-offset-4">
              Create a second account
            </Link>{' '}
            to test membership and assignment flows once teams arrive.
          </p>
        </div>
      </main>
    </div>
  );
}
