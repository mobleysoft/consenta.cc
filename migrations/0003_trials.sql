-- consenta.cc — cross-venture trial entitlement ledger.
--
-- Real backing for the "conglomerate-wide trial invite emails" capability
-- (mascom/flagged_next_steps_backlog.json id
-- conglomerate-wide-trial-invite-emails): given {recipient email,
-- venture/product, trial_limit: {type, value}}, this table is the single
-- shared record of how much of a trial someone has left, checked by
-- whichever venture's real backend gates the product (first real consumer:
-- weylandai.com's requireProductAccess() for ephemeral SubX/TakeoffX/
-- CutsheetX/SightX sessions - see src/lib/auth.js in that repo, which
-- documented this exact gap: "there is deliberately NO usage-count
-- limiting in this pass... needs a real per-product decision about what
-- the limit should be, not an invented number").
--
-- Deliberately a THIRD, separate concern from suppressions (opt-out of
-- contact) and consents (opt-in to cross-venture data sharing) in this
-- same worker - a trial entitlement is neither of those, it's "how much
-- of a specific product trial has this specific invite been allotted and
-- used." Co-located here (not a new domain/Worker/D1) because consenta.cc
-- is already the real, live service sitting in this exact request path
-- (see CONSENT_INTEGRATION.md's documented intended integration: AuthFor's
-- ephemeral-invite claim redirects through consenta.cc/consent before
-- completing) - the claim page built alongside this migration (worker.js's
-- GET /claim) is the one real place both the consent question and the
-- trial-activation moment naturally happen together, in the same request.
--
-- id: the AuthFor ephemeral invite token itself (the `id` field returned by
-- POST https://authfor.com/api/v1/ephemeral/invite) - not a fresh UUID.
-- Using AuthFor's own token as the join key means no separate mapping
-- table is needed between "which invite" and "which trial."
--
-- limit_type: 'payloads' | 'time' (John's own wording: "the x number of
-- payloads or length of time we allot for that products trial").
-- limit_value: a payload count (limit_type='payloads') or a duration in
-- seconds (limit_type='time').
-- remaining_value: only meaningful for limit_type='payloads' - decremented
-- by consumeTrial() on each real usage tick. NULL for limit_type='time'
-- (time-based trials are checked against expires_at instead, never
-- decremented).
--
-- status: 'pending' (created, not yet claimed) -> 'active' (claimed -
-- the clock/counter starts here, NOT at send/create time, per John's own
-- wording "start using the trial") -> 'exhausted' (payload count hit
-- zero) | 'expired' (time limit passed). A pending trial has NOT started
-- its clock even if a long time has passed since it was created - only
-- activateTrial() (called once, idempotently, from the real claim flow)
-- starts it.
CREATE TABLE IF NOT EXISTS trial_entitlements (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  venture TEXT NOT NULL,
  product TEXT NOT NULL,
  limit_type TEXT NOT NULL,
  limit_value INTEGER NOT NULL,
  remaining_value INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  activated_at TEXT,
  expires_at TEXT,
  source_venture TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trial_entitlements_identifier ON trial_entitlements(identifier);
CREATE INDEX IF NOT EXISTS idx_trial_entitlements_venture_product ON trial_entitlements(venture, product);
