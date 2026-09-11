/**
 * consenta.cc — suppression list storage.
 *
 * The real product: a single, cross-venture "do not contact" record, keyed
 * on (identifier, channel), so any venture's outreach can check it before
 * contacting someone who already opted out somewhere else in the estate.
 * See migrations/0001_suppressions.sql for the schema and its rationale.
 */

export function normalizeIdentifier(identifier) {
  return String(identifier || '').trim().toLowerCase();
}

const VALID_CHANNELS = new Set(['email', 'sms', 'imessage']);

export function isValidChannel(channel) {
  return VALID_CHANNELS.has(channel);
}

/**
 * Upsert a suppression record. Real upsert (not an append-only log) -
 * (identifier, channel) is UNIQUE, so recording the same person opting out
 * of the same channel twice just refreshes recorded_at/source/reason
 * rather than creating a duplicate row.
 */
export async function recordSuppression(env, { identifier, channel, sourceVenture, reason }) {
  const id = crypto.randomUUID();
  const normalized = normalizeIdentifier(identifier);
  const recordedAt = new Date().toISOString();
  await env.CONSENTA_DB
    .prepare(
      `INSERT INTO suppressions (id, identifier, channel, source_venture, reason, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(identifier, channel) DO UPDATE SET
         source_venture = excluded.source_venture,
         reason = excluded.reason,
         recorded_at = excluded.recorded_at`
    )
    .bind(id, normalized, channel, sourceVenture, reason || null, recordedAt)
    .run();
  return { identifier: normalized, channel, source_venture: sourceVenture, reason: reason || null, recorded_at: recordedAt };
}

export async function checkSuppression(env, identifier, channel) {
  const normalized = normalizeIdentifier(identifier);
  const row = await env.CONSENTA_DB
    .prepare('SELECT identifier, channel, source_venture, reason, recorded_at FROM suppressions WHERE identifier = ? AND channel = ?')
    .bind(normalized, channel)
    .first();
  return row || null;
}
