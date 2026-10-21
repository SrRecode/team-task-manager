import { TASK_STATUSES, statusLabel } from './taskStatus';

const controlClass =
  'w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum';

/**
 * The filter bar of the dashboard: search text, team, assignee and status.
 *
 * Every control reports the new value; the dashboard owns the filter state and
 * the list that it produces.
 */
export default function TaskFilters({ filters, onChange, teams, members, onClear }) {
  const hasFilters = Boolean(filters.teamId || filters.assigneeId || filters.status || filters.search);

  return (
    <section
      aria-label="Task filters"
      className="rounded-xl border border-line bg-surface p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="filter-search" className="block text-sm font-medium text-ink">
            Search
          </label>
          <input
            id="filter-search"
            type="search"
            maxLength={200}
            placeholder="Title or description"
            value={filters.search}
            onChange={(event) => onChange({ ...filters, search: event.target.value })}
            className={`mt-1 ${controlClass}`}
          />
        </div>

        <div>
          <label htmlFor="filter-team" className="block text-sm font-medium text-ink">
            Team
          </label>
          <select
            id="filter-team"
            value={filters.teamId}
            onChange={(event) => onChange({ ...filters, teamId: event.target.value })}
            className={`mt-1 ${controlClass}`}
          >
            <option value="">All teams</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-assignee" className="block text-sm font-medium text-ink">
            Assignee
          </label>
          <select
            id="filter-assignee"
            value={filters.assigneeId}
            onChange={(event) => onChange({ ...filters, assigneeId: event.target.value })}
            className={`mt-1 ${controlClass}`}
          >
            <option value="">All assignees</option>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-status" className="block text-sm font-medium text-ink">
            Status
          </label>
          <select
            id="filter-status"
            value={filters.status}
            onChange={(event) => onChange({ ...filters, status: event.target.value })}
            className={`mt-1 ${controlClass}`}
          >
            <option value="">All statuses</option>
            {TASK_STATUSES.map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {hasFilters ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-3 text-sm font-medium text-plum-soft underline underline-offset-4 hover:text-coral"
        >
          Clear all filters
        </button>
      ) : null}
    </section>
  );
}
