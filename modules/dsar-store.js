/**
 * consenta.cc — data subject access/deletion/portability request (DSAR)
 * intake + status tracking.
 *
 * Real, honestly-scoped: this stores and tracks real requests. It does not
 * fulfill them automatically — no jurisdiction rules engine, no auto-deletion
 * of records in other ventures' systems, no regulator reporting. Resolving a
 * request (actually deleting/exporting the person's data elsewhere) is real
 * work a person does; resolveDsarRequest() just records that it happened,
 * with an honest note of what was done.
 *
 * See migrations/0004_dsar_requests.sql for the schema and its rationale.
 */

export function normalizeIdentifier(identifier) {
  return String(identifier || '').trim().toLowerCase();
}

const VALID_REQUEST_TYPES = new Set(['access', 'deletion', 'portability']);
const VALID_STATUSES = new Set(['pending', 'in_progress', 'resolved', 'rejected']);

export function isValidRequestType(type) {
  return VALID_REQUEST_TYPES.has(type);
}

export function isValidStatus(status) {
  return VALID_STATUSES.has(status);
}

export async function createDsarRequest(env, { identifier, requestType, sourceVenture, details }) {
  const id = crypto.randomUUID();
  const normalized = normalizeIdentifier(identifier);
  const createdAt = new Date().toISOString();
  await env.CONSENTA_DB
    .prepare(
      `INSERT INTO dsar_requests (id, identifier, request_type, source_venture, details, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`
    )
    .bind(id, normalized, requestType, sourceVenture, details || null, createdAt)
    .run();
  return {
    id, identifier: normalized, request_type: requestType, source_venture: sourceVenture,
    details: details || null, status: 'pending', created_at: createdAt, resolved_at: null, resolution_note: null,
  };
}

export async function getDsarRequest(env, id) {
  return env.CONSENTA_DB
    .prepare('SELECT * FROM dsar_requests WHERE id = ?')
    .bind(id)
    .first();
}

export async function listDsarRequestsByIdentifier(env, identifier) {
  const normalized = normalizeIdentifier(identifier);
  const result = await env.CONSENTA_DB
    .prepare('SELECT * FROM dsar_requests WHERE identifier = ? ORDER BY created_at DESC')
    .bind(normalized)
    .all();
  return result.results || [];
}

/**
 * The real operator-facing queue: every request still awaiting action,
 * oldest first (FIFO - the honest order a real compliance queue should be
 * worked in). Separate from listDsarRequestsByIdentifier, which answers a
 * different question ("what's on file for this one person") - this answers
 * "what's outstanding across everyone," the thing an actual person needs to
 * see before resolveDsarRequest() means anything as a real workflow rather
 * than a raw API call nobody but a script can reach.
 */
export async function listPendingDsarRequests(env, { limit = 100 } = {}) {
  const result = await env.CONSENTA_DB
    .prepare(
      `SELECT * FROM dsar_requests WHERE status IN ('pending', 'in_progress') ORDER BY created_at ASC LIMIT ?`
    )
    .bind(limit)
    .all();
  return result.results || [];
}

/**
 * Record that a real request was actually actioned. status must be
 * 'resolved' or 'rejected' — 'pending'/'in_progress' aren't valid resolution
 * outcomes (use a separate status-only update for those if that need arises
 * for real; not built speculatively here).
 */
export async function resolveDsarRequest(env, id, { status, resolutionNote }) {
  if (status !== 'resolved' && status !== 'rejected') {
    throw new Error("resolveDsarRequest status must be 'resolved' or 'rejected'");
  }
  const resolvedAt = new Date().toISOString();
  await env.CONSENTA_DB
    .prepare(
      `UPDATE dsar_requests SET status = ?, resolved_at = ?, resolution_note = ? WHERE id = ?`
    )
    .bind(status, resolvedAt, resolutionNote || null, id)
    .run();
  return getDsarRequest(env, id);
}
