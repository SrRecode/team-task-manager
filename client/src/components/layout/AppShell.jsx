import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';

/**
 * The signed in page frame: the product header, the current user and a sign
 * out button.
 */
export default function AppShell({ children }) {
  const { user, logout, acceptedInvites, dismissAcceptedInvites } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-plum-soft">
              Glacier Agency
            </p>
            <h1 className="text-lg font-semibold text-ink">Team Task Manager</h1>
          </div>

          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 md:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen((open) => !open)}
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? 'Close the menu' : 'Open the menu'}
              aria-controls="mobile-menu"
              className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-coral/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
            >
              {mobileOpen ? 'Close' : 'Menu'}
            </button>
          </nav>

          <nav id="mobile-menu" className="flex w-full flex-col gap-2 md:hidden" aria-label="Mobile navigation">
            {mobileOpen ? (
              <>
                <Link
                  to="/"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg border border-line bg-surface px-4 py-3 text-sm font-medium text-ink hover:bg-paper"
                >
                  Dashboard
                </Link>
                <Link
                  to="/teams"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg border border-line bg-surface px-4 py-3 text-sm font-medium text-ink hover:bg-paper"
                >
                  Teams
                </Link>
                <div className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3">
                  <span className="text-sm text-ink-muted">{user?.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      logout();
                    }}
                    className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-coral/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
                  >
                    Sign out
                  </button>
                </div>
              </>
            ) : null}
          </nav>

          <nav className="hidden flex-wrap items-center gap-x-4 gap-y-2 md:flex md:w-auto">
            <Link
              to="/"
              className="text-sm font-medium text-ink-muted underline underline-offset-4 hover:text-ink"
            >
              Dashboard
            </Link>
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

      <main className="mx-auto max-w-5xl px-4 py-10">
        {acceptedInvites.length > 0 ? (
          <div
            role="status"
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-plum/30 bg-plum/10 px-4 py-3 text-sm text-ink"
          >
            <p>
              Your pending invitation turned into a membership:{' '}
              <span className="font-semibold">
                {acceptedInvites.map((invite) => invite.teamName).join(', ')}
              </span>
              .
            </p>
            <button
              type="button"
              onClick={dismissAcceptedInvites}
              className="text-xs font-medium text-plum-soft underline underline-offset-4 hover:text-coral"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {children}
      </main>
    </div>
  );
}
