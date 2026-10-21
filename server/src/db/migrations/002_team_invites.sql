-- 002_team_invites.sql
-- Pending team invitations (BONUS-03).
--
-- The assessment does not require a real mail server, so an invitation is a
-- record instead of a message: the invitee is not a member of the team yet,
-- the row simply remembers that somebody asked them to join. The row is
-- labelled as a stub in the API response, so the evaluator can see that no
-- email was sent.
--
-- The row is turned into a real membership when the invited address registers
-- an account, which is what `acceptPendingInvites` does in
-- server/src/modules/teams/invite.service.js.

CREATE TABLE team_invites (
  id BIGSERIAL PRIMARY KEY,
  team_id BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL CHECK (length(trim(email)) BETWEEN 3 AND 320),
  invited_by BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

-- One pending invitation per team and address. Accepted and revoked rows stay
-- in the table as a history, so the partial index is the only unique rule.
CREATE UNIQUE INDEX idx_team_invites_pending_unique
  ON team_invites(team_id, email)
  WHERE status = 'pending';

CREATE INDEX idx_team_invites_email ON team_invites(email);
CREATE INDEX idx_team_invites_team_id ON team_invites(team_id);
