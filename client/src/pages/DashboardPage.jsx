import { Link } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import { useAuth } from '../context/useAuth';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <AppShell>
      <div className="rounded-xl border border-line bg-surface p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          Welcome, {user?.name}
        </h2>
        <p className="mt-2 max-w-prose text-sm text-ink-muted">
          Your account is ready. Create a team, add the people you work with, and the task
          board will open up in the next milestone.
        </p>
        <Link
          to="/teams"
          className="mt-6 inline-block rounded-lg bg-plum px-4 py-2 text-sm font-semibold text-paper transition hover:bg-plum-soft"
        >
          Go to your teams
        </Link>
      </div>
    </AppShell>
  );
}
