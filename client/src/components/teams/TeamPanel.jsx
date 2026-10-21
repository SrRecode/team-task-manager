import { useCallback, useEffect, useState } from 'react';
import { teamsApi } from '../../api/teams.api';

function RoleBadge({ role }) {
  const isOwner = role === 'owner';

  return (
    <span
      className={
        isOwner
          ? 'rounded-full bg-plum px-2 py-0.5 text-xs font-semibold text-paper'
          : 'rounded-full border border-line bg-paper px-2 py-0.5 text-xs font-medium text-ink-muted'
      }
    >
      {isOwner ? 'Owner' : 'Member'}
    </span>
  );
}

/**
 * The detail panel for one team: its members, and the owner actions for
 * adding a member, renaming the team and deleting it.
 */
export default function TeamPanel({ team, currentUserId, onChanged, onDeleted }) {
  const [members, setMembers] = useState([]);
  const [membersError, setMembersError] = useState('');
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [email, setEmail] = useState('');
  const [addError, setAddError] = useState('');
  const [addPending, setAddPending] = useState(false);
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description);
  const [editError, setEditError] = useState('');
  const [editPending, setEditPending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);

  const isOwner = team.currentUserRole === 'owner';

  // The owner may remove any member, but not themselves: a team without an
  // owner could never be managed again. A member may only remove themselves.
  function canRemoveMember(member) {
    if (isOwner) return member.role !== 'owner';
    return member.userId === currentUserId;
  }

  const loadMembers = useCallback(() => {
    return teamsApi
      .listMembers(team.id)
      .then((payload) => {
        setMembers(payload.data.members);
        setMembersError('');
      })
      .catch((error) => {
        setMembersError(error.message);
      })
      .finally(() => {
        setLoadingMembers(false);
      });
  }, [team.id]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  async function handleAddMember(event) {
    event.preventDefault();
    setAddError('');
    setAddPending(true);
    try {
      await teamsApi.addMember(team.id, email);
      setEmail('');
      await loadMembers();
    } catch (error) {
      setAddError(error.message);
    } finally {
      setAddPending(false);
    }
  }

  async function handleRemoveMember(userId) {
    setMembersError('');
    try {
      await teamsApi.removeMember(team.id, userId);
      await loadMembers();
      onChanged();
    } catch (error) {
      setMembersError(error.message);
    }
  }

  async function handleUpdate(event) {
    event.preventDefault();
    setEditError('');
    setEditPending(true);
    try {
      await teamsApi.update(team.id, { name, description });
      onChanged();
    } catch (error) {
      setEditError(error.message);
    } finally {
      setEditPending(false);
    }
  }

  async function handleDelete() {
    setEditError('');
    setDeletePending(true);
    try {
      await teamsApi.remove(team.id);
      onDeleted();
    } catch (error) {
      setEditError(error.message);
      setDeletePending(false);
    }
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-ink">{team.name}</h2>
          <p className="mt-1 text-sm text-ink-muted">
            {team.description || 'No description yet.'}
          </p>
        </div>
        <RoleBadge role={team.currentUserRole} />
      </div>

      <h3 className="mt-8 text-sm font-semibold uppercase tracking-wide text-ink-muted">
        Members
      </h3>

      {loadingMembers ? (
        <p className="mt-3 text-sm text-ink-muted">Loading members…</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {members.map((member) => (
            <li key={member.userId} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-ink">{member.name}</p>
                <p className="text-xs text-ink-muted">{member.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <RoleBadge role={member.role} />
                {canRemoveMember(member) && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(member.userId)}
                    className="text-xs font-medium text-plum-soft underline underline-offset-4 hover:text-coral"
                  >
                    {member.userId === currentUserId ? 'Leave' : 'Remove'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {membersError ? (
        <p role="alert" className="mt-3 text-sm text-coral">
          {membersError}
        </p>
      ) : null}

      {isOwner ? (
        <>
          <h3 className="mt-8 text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Add a member
          </h3>
          <form onSubmit={handleAddMember} className="mt-3 flex flex-wrap gap-2">
            <label htmlFor="member-email" className="sr-only">
              Email address of the member to add
            </label>
            <input
              id="member-email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="member@example.com"
              className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
            />
            <button
              type="submit"
              disabled={addPending}
              className="rounded-lg bg-plum px-4 py-2 text-sm font-semibold text-paper transition hover:bg-plum-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              {addPending ? 'Adding…' : 'Add member'}
            </button>
          </form>
          {addError ? (
            <p role="alert" className="mt-2 text-sm text-coral">
              {addError}
            </p>
          ) : null}

          <h3 className="mt-8 text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Team settings
          </h3>
          <form onSubmit={handleUpdate} className="mt-3 space-y-3">
            <div>
              <label htmlFor="team-name" className="block text-sm font-medium text-ink">
                Name
              </label>
              <input
                id="team-name"
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
              <label htmlFor="team-description" className="block text-sm font-medium text-ink">
                Description
              </label>
              <textarea
                id="team-description"
                name="description"
                rows={3}
                maxLength={2000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
              />
            </div>
            <button
              type="submit"
              disabled={editPending}
              className="rounded-lg border border-line bg-paper px-4 py-2 text-sm font-semibold text-ink transition hover:bg-coral/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {editPending ? 'Saving…' : 'Save changes'}
            </button>
          </form>

          {editError ? (
            <p role="alert" className="mt-2 text-sm text-coral">
              {editError}
            </p>
          ) : null}

          <div className="mt-8 border-t border-line pt-6">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deletePending}
              className="rounded-lg border border-coral/60 px-4 py-2 text-sm font-semibold text-plum-soft transition hover:bg-coral/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deletePending ? 'Deleting…' : 'Delete team'}
            </button>
            <p className="mt-2 text-xs text-ink-muted">
              Deleting a team removes its memberships and its tasks.
            </p>
          </div>
        </>
      ) : (
        <p className="mt-6 text-sm text-ink-muted">
          Only the team owner can add members or change the team settings.
        </p>
      )}
    </section>
  );
}
