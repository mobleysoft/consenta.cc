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
import { createTrial, getTrial, activateTrial, consumeTrial, isValidLimitType } from './modules/trials-store.js';
import { createDsarRequest, getDsarRequest, listDsarRequestsByIdentifier, listPendingDsarRequests, resolveDsarRequest, isValidRequestType, normalizeIdentifier as normalizeDsarIdentifier } from './modules/dsar-store.js';

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

// --- DSAR self-service form ---
//
// Real next rung named by this venture's own 2026-09-13 next_step: the
// /api/v1/dsar intake API existed but nothing let a real person actually
// file a request through it - only server-to-server callers could reach
// it. This is the same honest pattern as /consent above: a plain HTML
// form, no auth gate (same internal trust model as every other endpoint
// in this file), POSTs straight to the real /api/v1/dsar endpoint, shows
// the real returned request id so the person can check status later via
// GET /api/v1/dsar/:id. Intake + status only - filing a request here does
// not automatically fulfill it (see DSAR_INTEGRATION.md).
function dsarPageHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Data request — consenta.cc</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 8vh auto; padding: 0 24px; color: #1a1a1a; line-height: 1.5; }
  h1 { font-size: 1.35rem; }
  p { color: #333; }
  label { display: block; font-weight: 600; margin-top: 18px; margin-bottom: 6px; font-size: 0.9rem; }
  input, select, textarea { width: 100%; box-sizing: border-box; padding: 10px 12px; font-size: 1rem; border-radius: 8px; border: 1px solid #ccc; font-family: inherit; }
  textarea { resize: vertical; min-height: 70px; }
  button { margin-top: 24px; width: 100%; padding: 14px 16px; font-size: 1rem; border-radius: 8px; border: 1px solid #111; background: #111; color: #fff; cursor: pointer; }
  button:disabled { opacity: 0.6; cursor: default; }
  .fineprint { margin-top: 20px; font-size: 0.85rem; color: #666; }
  #status { margin-top: 20px; font-weight: 600; }
  #status.error { color: #b00020; }
  .reqid { font-family: ui-monospace, Menlo, monospace; background: #f2f2f2; padding: 2px 6px; border-radius: 4px; }
</style>
</head>
<body>
  <h1>Request your data</h1>
  <p>
    Use this form to ask a MobCorp venture to show you what it has on file
    for you, delete it, or send you a copy. This records and tracks a real
    request - it does not fulfill it automatically; a real person reviews
    and resolves each one.
  </p>
  <form id="dsarForm">
    <label for="identifier">Your email or identifier</label>
    <input id="identifier" name="identifier" type="text" required placeholder="you@example.com">

    <label for="sourceVenture">Which venture is this about?</label>
    <input id="sourceVenture" name="sourceVenture" type="text" required placeholder="e.g. salesfactorai.com">

    <label for="requestType">What are you requesting?</label>
    <select id="requestType" name="requestType">
      <option value="access">Access - show me what you have</option>
      <option value="deletion">Deletion - delete my data</option>
      <option value="portability">Portability - send me a copy</option>
    </select>

    <label for="details">Anything else we should know? (optional)</label>
    <textarea id="details" name="details" placeholder="Optional details"></textarea>

    <button id="submitBtn" type="submit">Submit request</button>
  </form>
  <div id="status"></div>
  <p class="fineprint">No auth gate on this form yet - only submits a real, logged request against the identifier and venture you enter.</p>
<script>
(function () {
  var form = document.getElementById('dsarForm');
  var submitBtn = document.getElementById('submitBtn');
  var statusEl = document.getElementById('status');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    submitBtn.disabled = true;
    statusEl.className = '';
    statusEl.textContent = 'Submitting...';
    fetch('/api/v1/dsar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: document.getElementById('identifier').value,
        request_type: document.getElementById('requestType').value,
        source_venture: document.getElementById('sourceVenture').value,
        details: document.getElementById('details').value || undefined,
      }),
    })
      .then(function (res) { return res.json().then(function (body) { return { ok: res.ok, body: body }; }); })
      .then(function (result) {
        if (!result.ok) {
          statusEl.className = 'error';
          statusEl.textContent = (result.body && result.body.detail && result.body.detail.message) || 'Something went wrong submitting your request.';
          submitBtn.disabled = false;
          return;
        }
        form.style.display = 'none';
        statusEl.innerHTML = 'Request received. Your request id is <span class="reqid">' + result.body.request.id + '</span> - save it to check status later.';
      })
      .catch(function () {
        statusEl.className = 'error';
        statusEl.textContent = 'Something went wrong submitting your request. Please try again.';
        submitBtn.disabled = false;
      });
  });
})();
</script>
</body>
</html>`;
}

// --- Admin DSAR queue ---
//
// Real gap this closes: /api/v1/dsar's intake + /dsar's self-service form
// both work, but resolveDsarRequest() had no caller except a raw
// POST /api/v1/dsar/:id/resolve - there was no way for the actual person
// doing DSAR fulfillment work to see what's outstanding or act on it
// without crafting API calls by hand. That's not a usable compliance
// workflow yet, whatever the intake side looks like.
//
// Unlike every other page in this file, this one is NOT meant to be public
// - it's the first internal-only surface in this worker, so it's the first
// one that needs an actual auth gate rather than inheriting the "logged,
// not gated" trust model documented at the top of this file. Fails CLOSED:
// if CONSENTA_ADMIN_TOKEN isn't configured, access is denied, not open -
// same fail-closed philosophy already used for consent checks above.
function isAdminAuthorized(request, url, env) {
  const configured = env.CONSENTA_ADMIN_TOKEN;
  if (!configured) return false;
  const authHeader = request.headers.get('Authorization') || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const provided = bearer || url.searchParams.get('token');
  return !!provided && provided === configured;
}

function adminDsarPageHtml({ requests, token }) {
  const tokenJson = JSON.stringify(token);
  const rows = requests.map((r) => `
    <tr data-id="${escapeHtml(r.id)}">
      <td class="mono">${escapeHtml(r.id.slice(0, 8))}</td>
      <td>${escapeHtml(r.identifier)}</td>
      <td>${escapeHtml(r.request_type)}</td>
      <td>${escapeHtml(r.source_venture)}</td>
      <td>${escapeHtml(r.details || '')}</td>
      <td>${escapeHtml(r.created_at)}</td>
      <td>${escapeHtml(r.status)}</td>
      <td>
        <select class="status-choice"><option value="resolved">Resolved</option><option value="rejected">Rejected</option></select>
        <input class="note" type="text" placeholder="Resolution note (optional)">
        <button type="button" class="resolve-btn">Resolve</button>
      </td>
    </tr>`).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DSAR queue — consenta.cc admin</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 4vh 24px; color: #1a1a1a; }
  h1 { font-size: 1.4rem; }
  table { border-collapse: collapse; width: 100%; font-size: 0.9rem; }
  th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; vertical-align: top; }
  th { background: #f2f2f2; }
  .mono { font-family: ui-monospace, Menlo, monospace; }
  .note { width: 160px; }
  .empty { color: #666; margin-top: 20px; }
  .row-status { margin-top: 6px; font-size: 0.85rem; }
</style>
</head>
<body>
  <h1>Outstanding DSAR requests (${requests.length})</h1>
  ${requests.length === 0 ? '<p class="empty">Nothing pending - the queue is empty.</p>' : `
  <table>
    <thead><tr><th>ID</th><th>Identifier</th><th>Type</th><th>Venture</th><th>Details</th><th>Created</th><th>Status</th><th>Resolve</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`}
<script>
(function () {
  var token = ${tokenJson};
  document.querySelectorAll('.resolve-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var row = btn.closest('tr');
      var id = row.getAttribute('data-id');
      var status = row.querySelector('.status-choice').value;
      var note = row.querySelector('.note').value;
      btn.disabled = true;
      fetch('/admin/dsar/' + encodeURIComponent(id) + '/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ status: status, resolution_note: note || undefined }),
      })
        .then(function (res) { return res.json().then(function (b) { return { ok: res.ok, body: b }; }); })
        .then(function (result) {
          if (result.ok) {
            row.querySelectorAll('td')[6].textContent = result.body.request.status;
            row.querySelector('td:last-child').innerHTML = '<span class="row-status">Done.</span>';
          } else {
            btn.disabled = false;
            alert((result.body && result.body.error) || 'Failed to resolve.');
          }
        })
        .catch(function () { btn.disabled = false; alert('Failed to resolve.'); });
    });
  });
})();
</script>
</body>
</html>`;
}

// --- Trial claim page ---
//
// The real "claim the profile and start using the trial" moment: a person
// clicks the magic-link claim button in a pitch email (sent via
// mailguyai.com, see mascom/trial-invite-batch.mjs), lands here first
// (not directly at the venture or at AuthFor), and this page:
//   1. confirms the AuthFor ephemeral invite token is still real/unexpired
//      (a live server-side call to AuthFor - never trust the URL alone),
//   2. asks the one real consent question (same fail-closed
//      cross_venture_data_sharing scope as /consent above - not a second,
//      divergent consent mechanism), and
//   3. on submit, activates the trial_entitlements row for this token -
//      this is the CLAIM moment per John's own wording ("start using the
//      trial"), not send time and not invite-creation time.
// A trial already claimed before (status != 'pending') skips straight to
// "continue to your trial" - asking the same consent question twice on a
// repeat visit would be a real UX bug, not required correctness.
function claimPageHtml({ token, trial, returnTo }) {
  const safeVenture = escapeHtml(trial.venture);
  const safeProduct = escapeHtml(trial.product);
  const limitLabel = trial.limit_type === 'payloads'
    ? `${trial.limit_value} payload${trial.limit_value === 1 ? '' : 's'}`
    : `${Math.round(trial.limit_value / 3600)} hour${Math.round(trial.limit_value / 3600) === 1 ? '' : 's'}`;
  const tokenJson = JSON.stringify(token);
  const returnToJson = JSON.stringify(returnTo || '');
  const identifierJson = JSON.stringify(trial.identifier);
  const ventureJson = JSON.stringify(trial.venture);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Claim your trial — consenta.cc</title>
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
  <h1>Claim your ${safeProduct} trial</h1>
  <p>
    You've been invited to try <strong>${safeProduct}</strong> from
    <strong>${safeVenture}</strong> — your trial covers
    <strong>${escapeHtml(limitLabel)}</strong>, starting the moment you
    claim it below (not from whenever this email was sent).
  </p>
  <p>
    Before we activate it: <span class="identifier">${escapeHtml(trial.identifier)}</span>
    was given to ${safeVenture} for this invite. consenta.cc is the one
    place in this group of companies that actually asks before that info
    is kept and shared with any of our other ventures. If you choose
    <strong>Allow</strong>, your info may be shared with and retained by
    other Mobleysoft/MobCorp ventures. If you choose <strong>Decline</strong>,
    it stays only with ${safeVenture} — either way, your trial activates.
  </p>
  <div class="buttons">
    <button id="decline" type="button">Decline &amp; claim trial</button>
    <button id="allow" type="button">Allow &amp; claim trial</button>
  </div>
  <div id="status"></div>
  <p class="fineprint">No record of a decision means your info is treated as NOT consented for sharing, by default.</p>
<script>
(function () {
  var token = ${tokenJson};
  var returnTo = ${returnToJson};
  var identifier = ${identifierJson};
  var venture = ${ventureJson};
  var allowBtn = document.getElementById('allow');
  var declineBtn = document.getElementById('decline');
  var statusEl = document.getElementById('status');

  function submit(granted) {
    allowBtn.disabled = true;
    declineBtn.disabled = true;
    statusEl.textContent = 'Activating your trial...';
    fetch('/api/v1/trials/' + encodeURIComponent(token) + '/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ granted: granted }),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || !data.trial) {
          statusEl.textContent = 'Something went wrong activating your trial. Please try again.';
          allowBtn.disabled = false;
          declineBtn.disabled = false;
          return;
        }
        statusEl.textContent = 'Your trial is active. Redirecting you to ' + venture + '...';
        if (returnTo) {
          var url = new URL(returnTo);
          url.searchParams.set('trial_token', token);
          window.location.href = url.toString();
        }
      })
      .catch(function () {
        statusEl.textContent = 'Something went wrong activating your trial. Please try again.';
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

function claimAlreadyActiveHtml({ trial, returnTo }) {
  const safeVenture = escapeHtml(trial.venture);
  const safeProduct = escapeHtml(trial.product);
  const url = returnTo ? (() => { const u = new URL(returnTo); u.searchParams.set('trial_token', trial.id); return u.toString(); })() : null;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Continue your trial — consenta.cc</title></head>
<body style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 10vh auto; padding: 0 24px;">
  <h1>Your ${safeProduct} trial is already active</h1>
  <p>Status: <strong>${escapeHtml(trial.status)}</strong>${trial.limit_type === 'payloads' ? ` — ${trial.remaining_value} payload(s) remaining` : ''}.</p>
  ${url ? `<p><a href="${escapeHtml(url)}">Continue to ${safeVenture}</a></p>` : `<p>Return to ${safeVenture} to continue.</p>`}
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

    // POST /api/v1/dsar - real data subject access/deletion/portability
    // request intake. Honestly scoped: this records and tracks a real
    // request, it does not fulfill it automatically - no jurisdiction rules
    // engine, no auto-deletion elsewhere. See modules/dsar-store.js.
    if (method === 'POST' && pathname === '/api/v1/dsar') {
      let body;
      try {
        body = await request.json();
      } catch {
        return err('Invalid JSON body', 'INVALID_INPUT');
      }
      const { identifier, request_type: requestType, source_venture: sourceVenture, details } = body || {};
      if (!identifier) return err('Required: identifier', 'INVALID_INPUT');
      if (!requestType || !isValidRequestType(requestType)) {
        return err("Required: request_type must be one of 'access', 'deletion', 'portability'", 'INVALID_INPUT');
      }
      if (!sourceVenture) return err('Required: source_venture', 'INVALID_INPUT');

      const result = await createDsarRequest(env, { identifier, requestType, sourceVenture, details });

      // Log every write - same audit-trail discipline as every other
      // endpoint in this file, since there's no auth gate to rely on instead.
      console.log(
        `[consenta.cc dsar] created id=${result.id} identifier=${result.identifier} request_type=${requestType} source_venture=${sourceVenture}`
      );

      return json({ created: true, request: result }, 201);
    }

    // GET /api/v1/dsar?identifier=X - a real person (or the venture that
    // collected their info) checking what requests are on file for them.
    if (method === 'GET' && pathname === '/api/v1/dsar') {
      const identifier = url.searchParams.get('identifier');
      if (!identifier) return err('Required query param: identifier', 'INVALID_INPUT');
      const requests = await listDsarRequestsByIdentifier(env, identifier);
      return json({ identifier: normalizeDsarIdentifier(identifier), requests });
    }

    // GET /api/v1/dsar/:id - real status check for one specific request.
    const dsarGetMatch = pathname.match(/^\/api\/v1\/dsar\/([^/]+)$/);
    if (method === 'GET' && dsarGetMatch) {
      const dsarRequest = await getDsarRequest(env, decodeURIComponent(dsarGetMatch[1]));
      if (!dsarRequest) return err('No DSAR request found for this id', 'NOT_FOUND', 404);
      return json({ request: dsarRequest });
    }

    // POST /api/v1/dsar/:id/resolve - record that a request was actually
    // actioned (or rejected) by whoever did the real work. No auth gate yet
    // - same internal trust model as every other endpoint here - so this is
    // only as safe as who has the URL, same as suppressions/consent/trials.
    const dsarResolveMatch = pathname.match(/^\/api\/v1\/dsar\/([^/]+)\/resolve$/);
    if (method === 'POST' && dsarResolveMatch) {
      const id = decodeURIComponent(dsarResolveMatch[1]);
      let body;
      try {
        body = await request.json();
      } catch {
        return err('Invalid JSON body', 'INVALID_INPUT');
      }
      const { status, resolution_note: resolutionNote } = body || {};
      if (status !== 'resolved' && status !== 'rejected') {
        return err("Required: status must be 'resolved' or 'rejected'", 'INVALID_INPUT');
      }
      const existing = await getDsarRequest(env, id);
      if (!existing) return err('No DSAR request found for this id', 'NOT_FOUND', 404);

      const result = await resolveDsarRequest(env, id, { status, resolutionNote });
      console.log(`[consenta.cc dsar] ${status} id=${id} identifier=${existing.identifier}`);
      return json({ resolved: true, request: result });
    }

    // POST /api/v1/trials - create a real, pending trial entitlement for
    // an AuthFor ephemeral-invite token. Called by whichever venture/batch
    // process created the invite (e.g. mascom/trial-invite-batch.mjs),
    // right after a successful POST to AuthFor's /api/v1/ephemeral/invite -
    // `invite_token` here is that call's returned `token`, unchanged.
    if (method === 'POST' && pathname === '/api/v1/trials') {
      let body;
      try {
        body = await request.json();
      } catch {
        return err('Invalid JSON body', 'INVALID_INPUT');
      }
      const { invite_token: inviteToken, identifier, venture, product, trial_limit: trialLimit, source_venture: sourceVenture } = body || {};
      if (!inviteToken) return err('Required: invite_token', 'INVALID_INPUT');
      if (!identifier) return err('Required: identifier', 'INVALID_INPUT');
      if (!venture) return err('Required: venture', 'INVALID_INPUT');
      if (!product) return err('Required: product', 'INVALID_INPUT');
      if (!trialLimit || !isValidLimitType(trialLimit.type)) {
        return err("Required: trial_limit.type must be 'payloads' or 'time'", 'INVALID_INPUT');
      }
      if (!(Number(trialLimit.value) > 0)) return err('Required: trial_limit.value must be a positive number', 'INVALID_INPUT');

      const existing = await getTrial(env, inviteToken);
      if (existing) return err('A trial entitlement already exists for this invite_token', 'ALREADY_EXISTS', 400);

      try {
        const trial = await createTrial(env, {
          token: inviteToken, identifier, venture, product,
          limitType: trialLimit.type, limitValue: trialLimit.value, sourceVenture,
        });
        console.log(`[consenta.cc trials] created token=${inviteToken} identifier=${normalizeIdentifier(identifier)} venture=${venture} product=${product} limit=${trialLimit.type}:${trialLimit.value}`);
        return json({ created: true, trial }, 201);
      } catch (e) {
        return err(e.message || 'Failed to create trial', 'CREATE_FAILED', 400);
      }
    }

    // GET /api/v1/trials/:token - real status check (payloads remaining /
    // time remaining / claimed yet or not). Any venture holding a real
    // token can check this - same internal trust model as every other
    // cross-venture endpoint in this file.
    const trialGetMatch = pathname.match(/^\/api\/v1\/trials\/([^/]+)$/);
    if (method === 'GET' && trialGetMatch) {
      const trial = await getTrial(env, decodeURIComponent(trialGetMatch[1]));
      if (!trial) return err('No trial entitlement for this token', 'NOT_FOUND', 404);
      return json({ trial });
    }

    // POST /api/v1/trials/:token/consume - record one real usage tick
    // against an ACTIVE trial. Called server-to-server by the venture's
    // own backend at the moment it services a real request against the
    // trial's product (e.g. weylandai.com's requireProductAccess(), see
    // src/lib/auth.js in that repo). {ok:false} for an exhausted/expired/
    // not-yet-activated trial is a normal, expected outcome for the
    // caller to branch on - not a 4xx/5xx by itself.
    const trialConsumeMatch = pathname.match(/^\/api\/v1\/trials\/([^/]+)\/consume$/);
    if (method === 'POST' && trialConsumeMatch) {
      const token = decodeURIComponent(trialConsumeMatch[1]);
      let body = {};
      try { body = await request.json(); } catch { /* amount defaults below */ }
      const amount = Number(body?.amount) > 0 ? Number(body.amount) : 1;
      const result = await consumeTrial(env, token, amount);
      return json(result, result.ok ? 200 : 409);
    }

    // POST /api/v1/trials/:token/claim - the real CLAIM action: records
    // the cross-venture consent decision AND activates the trial's
    // clock/counter in one atomic request, called by the /claim page's own
    // JS below. Idempotent on the activation half (see activateTrial) -
    // calling this twice does not reset an already-active trial's clock.
    const trialClaimMatch = pathname.match(/^\/api\/v1\/trials\/([^/]+)\/claim$/);
    if (method === 'POST' && trialClaimMatch) {
      const token = decodeURIComponent(trialClaimMatch[1]);
      let body;
      try {
        body = await request.json();
      } catch {
        return err('Invalid JSON body', 'INVALID_INPUT');
      }
      const { granted } = body || {};
      if (typeof granted !== 'boolean') return err('Required: granted must be true or false', 'INVALID_INPUT');

      const existingTrial = await getTrial(env, token);
      if (!existingTrial) return err('No trial entitlement for this token', 'NOT_FOUND', 404);

      const consentResult = await recordConsent(env, {
        identifier: existingTrial.identifier, scope: CONSENT_SCOPE, granted, sourceVenture: existingTrial.venture,
      });
      const trial = await activateTrial(env, token);
      console.log(`[consenta.cc trials] claimed token=${token} identifier=${existingTrial.identifier} granted=${granted} status=${trial.status}`);

      return json({ consented: consentResult, trial }, 200);
    }

    // GET /claim?token=&return_to= - the real "claim the profile and start
    // using the trial" landing page a person reaches from the pitch
    // email's claim button. See claimPageHtml() above for the full design
    // note. return_to is the venture's own real page that knows how to
    // consume a ?trial_token= query param (e.g. weylandai.com's index.html
    // ephemeralToken(), which was extended alongside this feature to
    // honor an incoming trial_token instead of always minting a fresh
    // anonymous ephemeral session).
    if (method === 'GET' && pathname === '/claim') {
      const token = url.searchParams.get('token');
      const returnTo = url.searchParams.get('return_to') || '';
      if (!token) {
        return new Response(consentPageErrorHtml('This page requires a token query parameter.'), {
          status: 400,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }

      // Never trust the URL alone - confirm the AuthFor ephemeral invite
      // is still real and unexpired with a live server-side call before
      // showing anything.
      let verifyOk = false;
      try {
        const verifyResp = await fetch('https://authfor.com/api/v1/ephemeral/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        verifyOk = verifyResp.ok;
      } catch {
        verifyOk = false;
      }
      if (!verifyOk) {
        return new Response(consentPageErrorHtml('This invite link is invalid or has expired. Ask whoever sent it to resend your invite.'), {
          status: 404,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }

      const trial = await getTrial(env, token);
      if (!trial) {
        return new Response(consentPageErrorHtml('No trial was found for this invite link.'), {
          status: 404,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }

      const html = trial.status === 'pending'
        ? claimPageHtml({ token, trial, returnTo })
        : claimAlreadyActiveHtml({ trial, returnTo });
      return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
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

    // GET /dsar - the real self-service data-request form named in this
    // venture's own next_step (2026-09-13). No query params required -
    // this is meant to be reachable directly, unlike /consent and /claim
    // which are redirect targets.
    if (method === 'GET' && pathname === '/dsar') {
      return new Response(dsarPageHtml(), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // GET /admin/dsar?token= - the real operator-facing queue view named by
    // this venture's own 2026-09-17 next_step gap: /api/v1/dsar/:id/resolve
    // existed with no human-usable way to reach it. Internal-only - the
    // first auth-gated surface in this worker, see isAdminAuthorized() above.
    if (method === 'GET' && pathname === '/admin/dsar') {
      if (!isAdminAuthorized(request, url, env)) return err('Unauthorized', 'UNAUTHORIZED', 401);
      const requests = await listPendingDsarRequests(env);
      const token = (request.headers.get('Authorization') || '').startsWith('Bearer ')
        ? request.headers.get('Authorization').slice(7)
        : url.searchParams.get('token');
      return new Response(adminDsarPageHtml({ requests, token }), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // POST /admin/dsar/:id/resolve - the authenticated resolve action the
    // admin queue page above calls. Deliberately separate from the existing
    // unauthenticated POST /api/v1/dsar/:id/resolve (left unchanged, same
    // trust model as every other cross-venture endpoint in this file, in
    // case a trusted server-to-server caller already depends on it) -
    // additive, not a replacement.
    const adminDsarResolveMatch = pathname.match(/^\/admin\/dsar\/([^/]+)\/resolve$/);
    if (method === 'POST' && adminDsarResolveMatch) {
      if (!isAdminAuthorized(request, url, env)) return err('Unauthorized', 'UNAUTHORIZED', 401);
      const id = decodeURIComponent(adminDsarResolveMatch[1]);
      let body;
      try {
        body = await request.json();
      } catch {
        return err('Invalid JSON body', 'INVALID_INPUT');
      }
      const { status, resolution_note: resolutionNote } = body || {};
      if (status !== 'resolved' && status !== 'rejected') {
        return err("Required: status must be 'resolved' or 'rejected'", 'INVALID_INPUT');
      }
      const existing = await getDsarRequest(env, id);
      if (!existing) return err('No DSAR request found for this id', 'NOT_FOUND', 404);

      const result = await resolveDsarRequest(env, id, { status, resolutionNote });
      console.log(`[consenta.cc dsar admin] ${status} id=${id} identifier=${existing.identifier}`);
      return json({ resolved: true, request: result });
    }

    return err('Not found', 'NOT_FOUND', 404);
  },
};
