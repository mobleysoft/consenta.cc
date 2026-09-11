-- consenta.cc — cross-venture data-sharing consent ledger.
--
-- Separate, real question from migrations/0001_suppressions.sql. Suppressions
-- track explicit opt-OUT of being *contacted* on a channel. This table tracks
-- explicit opt-IN to a person's info being *retained and shared across more
-- than one MobCorp/Mobleysoft venture* (e.g. a lead salesfactorai.com sourced
-- becoming visible to weylandai.com's CRM, or an alhena.cc conversation
-- history being referenced by another venture). These are not the same
-- decision and must not be conflated into one table or endpoint - a person
-- could opt out of contact entirely while their existing data is still
-- shared, or consent to sharing while remaining reachable on every channel.
--
-- identifier: an email address or E.164 phone number (normalized the same
-- way as suppressions.identifier - trimmed, lowercased).
-- scope: a specific, real string naming what's being consented to. Only
-- 'cross_venture_data_sharing' exists today; the column is TEXT (not an
-- enum/CHECK constraint) so a genuinely new, real scope can be added later
-- without a migration, but no hypothetical scope is pre-registered here.
-- granted: 1 = consented, 0 = explicitly declined. Fail-closed is enforced
-- in application code (modules/consents-store.js), not by this schema: the
-- ABSENCE of a row must also read as "not consented", which a boolean
-- column alone can't express - see checkConsent()'s reason field.
-- UNIQUE(identifier, scope) makes POST /api/v1/consent an upsert (a person
-- changing their mind updates the existing decision, not an ever-growing log).
CREATE TABLE IF NOT EXISTS consents (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  scope TEXT NOT NULL,
  granted INTEGER NOT NULL,
  source_venture TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  UNIQUE(identifier, scope)
);

CREATE INDEX IF NOT EXISTS idx_consents_identifier_scope ON consents(identifier, scope);
