/**
 * consenta.cc — cross-venture trial entitlement storage.
 *
 * The real product: given an AuthFor ephemeral-invite token, a venture,
 * a product, and a trial_limit ({type: 'payloads'|'time', value: N}),
 * track how much of the trial is left and enforce that the clock/counter
 * starts at CLAIM time (activateTrial), not at send/create time - per
 * John's own wording, "start using the trial for the x number of
 * payloads or length of time we allot." See migrations/0003_trials.sql
 * for the schema and full design rationale.
 */

export function normalizeIdentifier(identifier) {
  return String(identifier || '').trim().toLowerCase();
}

const VALID_LIMIT_TYPES = new Set(['payloads', 'time']);

export function isValidLimitType(type) {
  return VALID_LIMIT_TYPES.has(type);
}

/**
 * Create a new, real trial entitlement, status='pending'. `id` is the
 * AuthFor ephemeral invite token (the join key - see migration header for
 * why this isn't a fresh UUID). Throws if a row already exists for this
 * token (an invite's entitlement should be created exactly once, at the
 * same time the invite itself is created).
 */
export async function createTrial(env, { token, identifier, venture, product, limitType, limitValue, sourceVenture }) {
  if (!token) throw new Error('createTrial requires token');
  if (!VALID_LIMIT_TYPES.has(limitType)) throw new Error(`invalid limitType: ${limitType}`);
  const numericLimit = Number(limitValue);
  if (!Number.isFinite(numericLimit) || numericLimit <= 0) throw new Error(`invalid limitValue: ${limitValue}`);

  const normalized = normalizeIdentifier(identifier);
  const createdAt = new Date().toISOString();
  const remaining = limitType === 'payloads' ? numericLimit : null;

  await env.CONSENTA_DB
    .prepare(
      `INSERT INTO trial_entitlements
         (id, identifier, venture, product, limit_type, limit_value, remaining_value, status, activated_at, expires_at, source_venture, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, ?, ?)`
    )
    .bind(token, normalized, venture, product, limitType, numericLimit, remaining, sourceVenture || null, createdAt)
    .run();

  return getTrial(env, token);
}

export async function getTrial(env, token) {
  const row = await env.CONSENTA_DB
    .prepare(
      `SELECT id, identifier, venture, product, limit_type, limit_value, remaining_value, status, activated_at, expires_at, source_venture, created_at
       FROM trial_entitlements WHERE id = ?`
    )
    .bind(token)
    .first();
  return row || null;
}

/**
 * Start the trial's clock/counter. Idempotent by design (per AuthFor's own
 * ephemeral/verify being callable any number of times without special-
 * casing repeats) - calling this again on an already-active trial just
 * returns its current state unchanged, it does NOT reset the clock or
 * refill the counter. Only a 'pending' trial is actually transitioned.
 */
export async function activateTrial(env, token) {
  const row = await getTrial(env, token);
  if (!row) return null;
  if (row.status !== 'pending') return row; // already active/exhausted/expired - no-op, idempotent

  const activatedAt = new Date().toISOString();
  let expiresAt = null;
  if (row.limit_type === 'time') {
    expiresAt = new Date(Date.now() + row.limit_value * 1000).toISOString();
  }

  await env.CONSENTA_DB
    .prepare(`UPDATE trial_entitlements SET status = 'active', activated_at = ?, expires_at = ? WHERE id = ?`)
    .bind(activatedAt, expiresAt, token)
    .run();

  return getTrial(env, token);
}

/**
 * Record real usage against an active trial. Returns
 * { ok, status, remaining, reason? } - ok=false (with a reason) rather
 * than throwing, since "trial exhausted" is an expected, common outcome a
 * caller needs to branch on, not an exceptional error.
 */
export async function consumeTrial(env, token, amount = 1) {
  const row = await getTrial(env, token);
  if (!row) return { ok: false, reason: 'NOT_FOUND' };
  if (row.status === 'pending') return { ok: false, reason: 'NOT_ACTIVATED', status: row.status };
  if (row.status === 'exhausted') return { ok: false, reason: 'EXHAUSTED', status: row.status, remaining: 0 };

  if (row.limit_type === 'time') {
    const expired = row.expires_at && new Date(row.expires_at) < new Date();
    if (expired && row.status !== 'expired') {
      await env.CONSENTA_DB.prepare(`UPDATE trial_entitlements SET status = 'expired' WHERE id = ?`).bind(token).run();
    }
    if (expired || row.status === 'expired') return { ok: false, reason: 'EXPIRED', status: 'expired' };
    return { ok: true, status: 'active', expires_at: row.expires_at };
  }

  // limit_type === 'payloads'
  const remainingBefore = row.remaining_value == null ? 0 : row.remaining_value;
  if (remainingBefore <= 0) {
    await env.CONSENTA_DB.prepare(`UPDATE trial_entitlements SET status = 'exhausted' WHERE id = ?`).bind(token).run();
    return { ok: false, reason: 'EXHAUSTED', status: 'exhausted', remaining: 0 };
  }
  const remainingAfter = Math.max(0, remainingBefore - amount);
  const newStatus = remainingAfter <= 0 ? 'exhausted' : 'active';
  await env.CONSENTA_DB
    .prepare(`UPDATE trial_entitlements SET remaining_value = ?, status = ? WHERE id = ?`)
    .bind(remainingAfter, newStatus, token)
    .run();
  return { ok: true, status: newStatus, remaining: remainingAfter };
}
