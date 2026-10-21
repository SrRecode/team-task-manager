import { Link } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';

/**
 * The signed in page frame: the product header, the current user and a sign
 * out button.
 */
export default function AppShell({ children }) {
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

          <nav className="flex items-center gap-4">
            <Link
              to="/teams"
              className="text-sm font-medium text-ink-muted underline underline-offset-4 hover:text-ink"
            >
              Teams
            </Link>
            <span className="text-sm text-ink-muted">{user?.name}</span>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-coral/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
            >
              Sign out
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">{children}</main>
    </div>
  );
}
