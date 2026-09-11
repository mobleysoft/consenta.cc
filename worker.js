/**
 * consenta-cc-worker — consenta.cc's first real capability.
 *
 * consenta.cc's declared purpose (ventures.json: "adaptive compliance
 * automation... regulatory adherence", subsumes OneTrust/TrustArc/BigID)
 * had never had any real functionality - the live domain was served
 * entirely by the shared mobley-venture-fleet-a template Worker, with no
 * dedicated Worker of its own (confirmed via the Cloudflare Workers Routes
 * API, 2026-09-11: consenta.cc/* and www.consenta.cc/* both resolved only
 * to mobley-venture-fleet-a).
 *
 * This Worker is deliberately narrow: it owns ONLY the
 * /api/v1/suppressions* path on the consenta.cc zone (see wrangler.toml's
 * `routes`), added as an ADDITIVE route alongside the existing
 * consenta.cc/* -> mobley-venture-fleet-a route, not a replacement of it.
 * Cloudflare matches the more specific route first, so every other path
 * on consenta.cc keeps being served exactly as before; nothing about the
 * generic venture brief changes. This Worker doesn't attempt to serve
 * index.html/blog.html/static assets at all - that's still fleet-a's job.
 *
 * Real, concrete gap this closes: two ventures independently track
 * contact-ability with no shared source of truth - alhena.cc's local
 * iMessage opt-out (mascom/alhena_checkin_companion.py's recipients.json)
 * and salesfactorai.com's cold-outreach contacts table (no
 * suppression/opt-out tracking of any kind). This gives both a single
 * real place to check.
 *
 * No auth on these endpoints yet - same trust model as other internal
 * cross-venture endpoints in this estate (e.g. mobley-venture-fleet-a's
 * shared waitlist capture). Every write is logged (console.log, visible in
 * `wrangler tail`) per the task's explicit requirement, since there's no
 * auth gate to rely on instead.
 */

import { recordSuppression, checkSuppression, isValidChannel, normalizeIdentifier } from './modules/suppressions-store.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function err(message, code = 'ERROR', status = 400) {
  return json({ error: message, code }, status);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;
    const { method } = request;

    if (method === 'OPTIONS') return new Response(null, { headers: CORS });

    if (method === 'GET' && pathname === '/api/v1/health') {
      return json({ status: 'ok', product: 'consenta-cc-suppressions', timestamp: Date.now() });
    }

    // POST /api/v1/suppressions - record (upsert) a suppression.
    if (method === 'POST' && pathname === '/api/v1/suppressions') {
      let body;
      try {
        body = await request.json();
      } catch {
        return err('Invalid JSON body', 'INVALID_INPUT');
      }
      const { identifier, channel, source_venture: sourceVenture, reason } = body || {};
      if (!identifier) return err('Required: identifier', 'INVALID_INPUT');
      if (!channel || !isValidChannel(channel)) {
        return err("Required: channel must be one of 'email', 'sms', 'imessage'", 'INVALID_INPUT');
      }
      if (!sourceVenture) return err('Required: source_venture', 'INVALID_INPUT');

      const result = await recordSuppression(env, { identifier, channel, sourceVenture, reason });

      // Log every write - required per spec, since these endpoints have no
      // auth gate to rely on for an audit trail instead.
      console.log(
        `[consenta.cc suppressions] recorded identifier=${result.identifier} channel=${channel} source_venture=${sourceVenture} reason=${reason || '(none)'}`
      );

      return json({ recorded: true, suppression: result }, 201);
    }

    // GET /api/v1/suppressions/check?identifier=X&channel=Y
    if (method === 'GET' && pathname === '/api/v1/suppressions/check') {
      const identifier = url.searchParams.get('identifier');
      const channel = url.searchParams.get('channel');
      if (!identifier) return err('Required query param: identifier', 'INVALID_INPUT');
      if (!channel || !isValidChannel(channel)) {
        return err("Required query param: channel must be one of 'email', 'sms', 'imessage'", 'INVALID_INPUT');
      }
      const row = await checkSuppression(env, identifier, channel);
      return json({
        identifier: normalizeIdentifier(identifier),
        channel,
        suppressed: !!row,
        ...(row ? { source_venture: row.source_venture, reason: row.reason, recorded_at: row.recorded_at } : {}),
      });
    }

    return err('Not found', 'NOT_FOUND', 404);
  },
};
