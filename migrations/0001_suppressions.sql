-- consenta.cc — cross-portfolio suppression list.
--
-- Real, narrow first capability for consenta.cc (2026-09-11): a shared
-- source of truth for "do not contact" state, so a recipient who opts out
-- of one venture's outreach (e.g. alhena.cc's iMessage check-ins) is
-- visible to any other venture that might independently try to reach the
-- same identifier (e.g. salesfactorai.com's cold-outreach contacts table).
-- Previously this state was invisible outside whichever single script set
-- it (alhena_checkin_companion.py's local recipients.json), which is
-- exactly the gap this table closes.
--
-- identifier: an email address or E.164 phone number.
-- channel: 'email' | 'sms' | 'imessage'.
-- UNIQUE(identifier, channel) makes POST /api/v1/suppressions an upsert,
-- not an ever-growing duplicate log.
CREATE TABLE IF NOT EXISTS suppressions (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  channel TEXT NOT NULL,
  source_venture TEXT NOT NULL,
  reason TEXT,
  recorded_at TEXT NOT NULL,
  UNIQUE(identifier, channel)
);

CREATE INDEX IF NOT EXISTS idx_suppressions_identifier_channel ON suppressions(identifier, channel);
