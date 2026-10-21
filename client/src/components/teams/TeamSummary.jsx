import { Link } from 'react-router-dom';

/**
 * The compact summary of the teams of the signed in user.
 *
 * The dashboard shows the tasks of every team, so the teams themselves belong
 * on the same page: the summary gives the name, the role of the user and the
 * number of members of every team, and links to the page that manages them.
 */
export default function TeamSummary({ teams, memberCounts }) {
  if (teams.length === 0) return null;

  return (
    <section aria-labelledby="team-summary-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3
          id="team-summary-heading"
          className="text-sm font-semibold uppercase tracking-wide text-ink-muted"
        >
          Your teams
        </h3>
        <Link
          to="/teams"
          className="text-xs font-medium text-plum-soft underline underline-offset-4 hover:text-coral"
        >
          Manage teams
        </Link>
      </div>

      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((team) => {
          const count = memberCounts[team.id] ?? 0;

          return (
            <li key={team.id} className="rounded-xl border border-line bg-surface p-4">
              <p className="truncate text-sm font-semibold text-ink">{team.name}</p>
              <p className="mt-1 line-clamp-2 text-xs text-ink-muted">
                {team.description || 'No description yet.'}
              </p>
              <p className="mt-2 text-xs text-ink-muted">
                {count} {count === 1 ? 'member' : 'members'}
                {' · '}
                {team.currentUserRole === 'owner' ? 'You are the owner' : 'You are a member'}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
