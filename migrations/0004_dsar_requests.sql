-- consenta.cc — data subject access/deletion/portability request intake.
--
-- Real next rung named in this venture's own ventures.json insight.next_step
-- ("a jurisdiction-specific rule, e.g. GDPR/CCPA data subject access request
-- intake tied to the existing consent ledger") — the first piece of this
-- venture's actual claimed purpose (subsumes OneTrust/TrustArc/BigID, all of
-- which sell DSAR handling as a core feature) beyond suppression/consent
-- tracking. Deliberately scoped honestly: this is INTAKE + STATUS TRACKING
-- only, not automated fulfillment — no jurisdiction rules engine, no
-- auto-deletion, no regulator reporting. A real request lands here, is
-- visible by identifier, and can be marked resolved with a note by whoever
-- (a person, for now) actually does the work. Claiming more than that would
-- repeat the exact overclaiming class this portfolio's doctrine exists to
-- catch (see AGENTS.md / mascom/CLAUDE.md).
--
-- request_type: 'access' | 'deletion' | 'portability' — the three real DSAR
-- request shapes GDPR/CCPA both recognize. TEXT, not an enum column, so a
-- genuinely new real type doesn't need a migration — validated in
-- application code (modules/dsar-store.js), same pattern as consent scope.
-- status: 'pending' (created, not yet actioned) -> 'in_progress' ->
-- 'resolved' | 'rejected'. No automatic transitions — every status change
-- past 'pending' is a real, explicit resolveDsarRequest() call.
-- details: optional free-text context the requester gave (e.g. "please
-- delete all records tied to this email"), never required.
CREATE TABLE IF NOT EXISTS dsar_requests (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  request_type TEXT NOT NULL,
  source_venture TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  resolution_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_dsar_requests_identifier ON dsar_requests(identifier);
CREATE INDEX IF NOT EXISTS idx_dsar_requests_status ON dsar_requests(status);
