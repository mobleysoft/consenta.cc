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
 * /api/v1/suppressions*, /api/v1/consent*, and /consent* paths on the
 * consenta.cc zone (see wrangler.toml's `routes`), added as ADDITIVE
 * routes alongside the existing consenta.cc/* -> mobley-venture-fleet-a
 * route, not a replacement of it. Cloudflare matches the more specific
 * route first, so every other path on consenta.cc keeps being served
 * exactly as before; nothing about the generic venture brief changes.
 * This Worker doesn't attempt to serve index.html/blog.html/other static
 * assets at all - that's still fleet-a's job.
 *
 * Real, concrete gap this closes: two ventures independently track
 * contact-ability with no shared source of truth - alhena.cc's local
 * iMessage opt-out (mascom/alhena_checkin_companion.py's recipients.json)
 * and salesfactorai.com's cold-outreach contacts table (no
 * suppression/opt-out tracking of any kind). This gives both a single
 * real place to check.
 *
 * A second, DELIBERATELY SEPARATE capability lives alongside the
 * suppression list: /api/v1/consent* and /consent (see
 * modules/consents-store.js). Suppressions track explicit opt-OUT of
 * being *contacted*. Consent tracks explicit opt-IN to a person's info
 * being *retained and shared across more than one venture* - a different
 * real question, not merged into the same table or endpoint. John's
 * direction: consenta.cc should be "the only firm that will save any of
 * their info if they so consent for it be used across our conglomerate" -
 * /consent is the real, honest, one-screen surface a real person sees to
 * answer that question, and /api/v1/consent/check is fail-closed: no
 * record on file reads as NOT consented, same as an explicit decline.
 *
 * No auth on these endpoints yet - same trust model as other internal
 * cross-venture endpoints in this estate (e.g. mobley-venture-fleet-a's
 * shared waitlist capture). Every write is logged (console.log, visible in
 * `wrangler tail`) per the task's explicit requirement, since there's no
 * auth gate to rely on instead.
 */

import { recordSuppression, checkSuppression, isValidChannel, normalizeIdentifier } from './modules/suppressions-store.js';
import { recordConsent, checkConsent, isValidScope, normalizeIdentifier as normalizeConsentIdentifier } from './modules/consents-store.js';

const CONSENT_SCOPE = 'cross_venture_data_sharing';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function consentPageHtml({ identifier, sourceVenture, returnUrl }) {
  const safeIdentifier = escapeHtml(identifier);
  const safeVenture = escapeHtml(sourceVenture);
  const returnUrlJson = JSON.stringify(returnUrl || '');
  const identifierJson = JSON.stringify(identifier);
  const ventureJson = JSON.stringify(sourceVenture);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Consent — consenta.cc</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 10vh auto; padding: 0 24px; color: #1a1a1a; line-height: 1.5; }
  h1 { font-size: 1.35rem; }
  p { color: #333; }
  .identifier { font-family: ui-monospace, Menlo, monospace; background: #f2f2f2; padding: 2px 6px; border-radius: 4px; }
  .buttons { display: flex; gap: 12px; margin-top: 28px; }
  button { flex: 1; padding: 14px 16px; font-size: 1rem; border-radius: 8px; border: 1px solid #ccc; cursor: pointer; }
  #allow { background: #111; color: #fff; border-color: #111; }
  #decline { background: #fff; color: #111; }
  button:disabled { opacity: 0.6; cursor: default; }
  .fineprint { margin-top: 20px; font-size: 0.85rem; color: #666; }
  #status { margin-top: 20px; font-weight: 600; }
</style>
</head>
<body>
  <h1>Can consenta.cc share your info across MobCorp ventures?</h1>
  <p>
    <span class="identifier">${safeIdentifier}</span> was given to
    <strong>${safeVenture}</strong>. consenta.cc is the one place in this
    group of companies that actually asks before that information is kept
    and shared with any of our other ventures.
  </p>
  <p>
    If you choose <strong>Allow</strong>, your info may be shared with and
    retained by other Mobleysoft/MobCorp ventures. If you choose
    <strong>Decline</strong>, it stays only with ${safeVenture} and is not
    shared. Either way, this doesn't change whether you can still be
    contacted - that's a separate choice, handled separately.
  </p>
  <p>You can change your mind at any time by revisiting this page.</p>
  <div class="buttons">
    <button id="decline" type="button">Decline</button>
    <button id="allow" type="button">Allow</button>
  </div>
  <div id="status"></div>
  <p class="fineprint">No record of a decision means your info is treated as NOT consented for sharing, by default.</p>
<script>
(function () {
  var identifier = ${identifierJson};
  var sourceVenture = ${ventureJson};
  var returnUrl = ${returnUrlJson};
  var scope = ${JSON.stringify(CONSENT_SCOPE)};
  var allowBtn = document.getElementById('allow');
  var declineBtn = document.getElementById('decline');
  var statusEl = document.getElementById('status');

  function submit(granted) {
    allowBtn.disabled = true;
    declineBtn.disabled = true;
    fetch('/api/v1/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: identifier, scope: scope, granted: granted, source_venture: sourceVenture }),
    })
      .then(function (res) { return res.json(); })
      .then(function () {
        statusEl.textContent = granted
          ? 'Thanks - your choice to allow sharing has been recorded.'
          : 'Understood - your choice to decline sharing has been recorded.';
        if (returnUrl) {
          var url = new URL(returnUrl);
          url.searchParams.set('consent', granted ? 'granted' : 'declined');
          window.location.href = url.toString();
        }
      })
      .catch(function () {
        statusEl.textContent = 'Something went wrong recording your choice. Please try again.';
        allowBtn.disabled = false;
        declineBtn.disabled = false;
      });
  }

  allowBtn.addEventListener('click', function () { submit(true); });
  declineBtn.addEventListener('click', function () { submit(false); });
})();
</script>
</body>
</html>`;
}

function consentPageErrorHtml(message) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Consent — consenta.cc</title></head>
<body style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 10vh auto; padding: 0 24px;">
  <h1>Missing information</h1>
  <p>${escapeHtml(message)}</p>
</body>
</html>`;
}

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

    // POST /api/v1/consent - upsert a real cross-venture data-sharing
    // consent decision. Deliberately separate from /api/v1/suppressions -
    // see file header. scope is left as an explicit input (not hardcoded)
    // so a genuinely new future scope doesn't require an endpoint change,
    // but only 'cross_venture_data_sharing' validates today.
    if (method === 'POST' && pathname === '/api/v1/consent') {
      let body;
      try {
        body = await request.json();
      } catch {
        return err('Invalid JSON body', 'INVALID_INPUT');
      }
      const { identifier, scope, granted, source_venture: sourceVenture } = body || {};
      if (!identifier) return err('Required: identifier', 'INVALID_INPUT');
      if (!scope || !isValidScope(scope)) {
        return err("Required: scope must be one of 'cross_venture_data_sharing'", 'INVALID_INPUT');
      }
      if (typeof granted !== 'boolean') return err('Required: granted must be true or false', 'INVALID_INPUT');
      if (!sourceVenture) return err('Required: source_venture', 'INVALID_INPUT');

      const result = await recordConsent(env, { identifier, scope, granted, sourceVenture });

      // Log every write - same discipline as suppressions, since there's
      // no auth gate on these endpoints to rely on for an audit trail.
      console.log(
        `[consenta.cc consent] recorded identifier=${result.identifier} scope=${scope} granted=${granted} source_venture=${sourceVenture}`
      );

      return json({ recorded: true, consent: result }, 201);
    }

    // GET /api/v1/consent/check?identifier=&scope=
    // Fail-closed: consented is false for BOTH "explicitly declined" and
    // "no record exists" - reason tells a caller which, if it needs to.
    if (method === 'GET' && pathname === '/api/v1/consent/check') {
      const identifier = url.searchParams.get('identifier');
      const scope = url.searchParams.get('scope');
      if (!identifier) return err('Required query param: identifier', 'INVALID_INPUT');
      if (!scope || !isValidScope(scope)) {
        return err("Required query param: scope must be one of 'cross_venture_data_sharing'", 'INVALID_INPUT');
      }
      const result = await checkConsent(env, identifier, scope);
      return json({
        identifier: normalizeConsentIdentifier(identifier),
        scope,
        consented: result.consented,
        reason: result.reason,
        ...(result.reason !== 'no_record' ? { source_venture: result.source_venture, recorded_at: result.recorded_at } : {}),
      });
    }

    // GET /consent?identifier=&source_venture=&return_url=
    // The real, honest, one-screen consent notice a real person sees at
    // the moment their info is first collected by a venture. Both Allow
    // and Decline are real choices calling POST /api/v1/consent before
    // optionally redirecting to return_url.
    if (method === 'GET' && pathname === '/consent') {
      const identifier = url.searchParams.get('identifier');
      const sourceVenture = url.searchParams.get('source_venture');
      const returnUrl = url.searchParams.get('return_url') || '';
      if (!identifier || !sourceVenture) {
        return new Response(consentPageErrorHtml('This page requires both identifier and source_venture query parameters.'), {
          status: 400,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
      return new Response(consentPageHtml({ identifier, sourceVenture, returnUrl }), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    return err('Not found', 'NOT_FOUND', 404);
  },
};
