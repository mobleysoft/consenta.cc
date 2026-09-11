/**
 * consenta.cc — cross-venture data-sharing consent storage.
 *
 * The real product: a single, cross-venture record of whether a specific
 * real person has explicitly agreed to have their info retained and shared
 * across more than one MobCorp/Mobleysoft venture. This is the opt-IN
 * counterpart to modules/suppressions-store.js's opt-OUT-of-contact record -
 * a deliberately separate table and separate question, not merged into one.
 *
 * Fail-closed by design: checkConsent() returns granted:false for BOTH an
 * explicit decline AND no record at all. The `reason` field lets a caller
 * that cares distinguish them ('granted' | 'declined' | 'no_record'), but
 * the boolean itself is always safe-by-default - a caller that only checks
 * the boolean can never mistake "we don't know" for "yes".
 *
 * See migrations/0002_consents.sql for the schema and its rationale.
 */

export function normalizeIdentifier(identifier) {
  return String(identifier || '').trim().toLowerCase();
}

// Only one real scope exists today. Deliberately not an exhaustive enum of
// hypothetical future scopes - see migration comment for why the column
// itself is left open (TEXT, no CHECK constraint) while this list stays
// narrow to what's actually asked for.
const VALID_SCOPES = new Set(['cross_venture_data_sharing']);

export function isValidScope(scope) {
  return VALID_SCOPES.has(scope);
}

/**
 * Upsert a consent decision. Real upsert (not an append-only log) -
 * (identifier, scope) is UNIQUE, so a person changing their mind (granting
 * after declining, or vice versa) updates the one real row rather than
 * creating a duplicate or leaving a stale earlier decision in place.
 */
export async function recordConsent(env, { identifier, scope, granted, sourceVenture }) {
  const id = crypto.randomUUID();
  const normalized = normalizeIdentifier(identifier);
  const recordedAt = new Date().toISOString();
  const grantedInt = granted ? 1 : 0;
  await env.CONSENTA_DB
    .prepare(
      `INSERT INTO consents (id, identifier, scope, granted, source_venture, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(identifier, scope) DO UPDATE SET
         granted = excluded.granted,
         source_venture = excluded.source_venture,
         recorded_at = excluded.recorded_at`
    )
    .bind(id, normalized, scope, grantedInt, sourceVenture, recordedAt)
    .run();
  return { identifier: normalized, scope, granted: !!grantedInt, source_venture: sourceVenture, recorded_at: recordedAt };
}

/**
 * Fail-closed lookup. Returns { consented, reason } - never throws on a
 * missing record, never defaults to true. reason is one of:
 *   'granted'   - a real row exists with granted = 1
 *   'declined'  - a real row exists with granted = 0
 *   'no_record' - no decision has ever been recorded for this identifier+scope
 */
export async function checkConsent(env, identifier, scope) {
  const normalized = normalizeIdentifier(identifier);
  const row = await env.CONSENTA_DB
    .prepare('SELECT identifier, scope, granted, source_venture, recorded_at FROM consents WHERE identifier = ? AND scope = ?')
    .bind(normalized, scope)
    .first();
  if (!row) {
    return { consented: false, reason: 'no_record' };
  }
  const granted = !!row.granted;
  return {
    consented: granted,
    reason: granted ? 'granted' : 'declined',
    source_venture: row.source_venture,
    recorded_at: row.recorded_at,
  };
}
