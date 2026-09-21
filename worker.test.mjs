// Real tests for consenta.cc's first two real endpoints - the suppression
// list. Exercises the actual default-export fetch() handler against a
// fake D1 (real upsert/select behavior, see test/fake-d1.mjs), not a
// reimplementation of the logic under test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.js';
import { fakeD1 } from './test/fake-d1.mjs';

function makeCtx() {
  return { waitUntil(p) {} };
}

function req(method, path, body) {
  const opts = { method };
  if (body !== undefined) {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify(body);
  }
  return new Request(`https://consenta.cc${path}`, opts);
}

test('GET /api/v1/health returns ok', async () => {
  const env = fakeD1();
  const res = await worker.fetch(req('GET', '/api/v1/health'), env, makeCtx());
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
});

test('POST /api/v1/suppressions: records a real suppression and returns 201', async () => {
  const env = fakeD1();
  const res = await worker.fetch(
    req('POST', '/api/v1/suppressions', {
      identifier: '+15551234567',
      channel: 'imessage',
      source_venture: 'alhena.cc',
      reason: 'STOP reply',
    }),
    env,
    makeCtx()
  );
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.recorded, true);
  assert.equal(body.suppression.identifier, '+15551234567');
  assert.equal(env._suppressions.length, 1);
  assert.equal(env._suppressions[0].source_venture, 'alhena.cc');
});

test('POST /api/v1/suppressions: missing identifier is a real 400, not a silent no-op', async () => {
  const env = fakeD1();
  const res = await worker.fetch(
    req('POST', '/api/v1/suppressions', { channel: 'email', source_venture: 'salesfactorai.com' }),
    env,
    makeCtx()
  );
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.code, 'INVALID_INPUT');
});

test('POST /api/v1/suppressions: an invalid channel is rejected', async () => {
  const env = fakeD1();
  const res = await worker.fetch(
    req('POST', '/api/v1/suppressions', {
      identifier: 'lead@acme.com',
      channel: 'carrier-pigeon',
      source_venture: 'salesfactorai.com',
    }),
    env,
    makeCtx()
  );
  assert.equal(res.status, 400);
});

test('POST /api/v1/suppressions: recording the same (identifier, channel) twice upserts, not duplicates', async () => {
  const env = fakeD1();
  await worker.fetch(
    req('POST', '/api/v1/suppressions', { identifier: 'lead@acme.com', channel: 'email', source_venture: 'mailguyai.com', reason: 'first' }),
    env,
    makeCtx()
  );
  const res2 = await worker.fetch(
    req('POST', '/api/v1/suppressions', { identifier: 'lead@acme.com', channel: 'email', source_venture: 'salesfactorai.com', reason: 'second' }),
    env,
    makeCtx()
  );
  assert.equal(res2.status, 201);
  assert.equal(env._suppressions.length, 1, 'UNIQUE(identifier, channel) must upsert, not append a duplicate row');
  assert.equal(env._suppressions[0].source_venture, 'salesfactorai.com');
  assert.equal(env._suppressions[0].reason, 'second');
});

test('POST /api/v1/suppressions: identifier is normalized (trimmed, lowercased) for consistent lookups', async () => {
  const env = fakeD1();
  await worker.fetch(
    req('POST', '/api/v1/suppressions', { identifier: '  Lead@Acme.com  ', channel: 'email', source_venture: 'mailguyai.com' }),
    env,
    makeCtx()
  );
  assert.equal(env._suppressions[0].identifier, 'lead@acme.com');
});

test('GET /api/v1/suppressions/check: a suppressed identifier returns suppressed:true with attribution', async () => {
  const env = fakeD1();
  await worker.fetch(
    req('POST', '/api/v1/suppressions', {
      identifier: '+15551234567',
      channel: 'imessage',
      source_venture: 'alhena.cc',
      reason: 'STOP reply',
    }),
    env,
    makeCtx()
  );
  const res = await worker.fetch(req('GET', '/api/v1/suppressions/check?identifier=%2B15551234567&channel=imessage'), env, makeCtx());
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.suppressed, true);
  assert.equal(body.source_venture, 'alhena.cc');
  assert.equal(body.reason, 'STOP reply');
});

test('GET /api/v1/suppressions/check: a non-suppressed identifier returns suppressed:false, not an error', async () => {
  const env = fakeD1();
  const res = await worker.fetch(req('GET', '/api/v1/suppressions/check?identifier=never-contacted@acme.com&channel=email'), env, makeCtx());
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.suppressed, false);
  assert.equal(body.source_venture, undefined);
});

test('GET /api/v1/suppressions/check: same identifier suppressed on one channel is NOT suppressed on another', async () => {
  const env = fakeD1();
  await worker.fetch(
    req('POST', '/api/v1/suppressions', { identifier: 'lead@acme.com', channel: 'email', source_venture: 'mailguyai.com' }),
    env,
    makeCtx()
  );
  const res = await worker.fetch(req('GET', '/api/v1/suppressions/check?identifier=lead@acme.com&channel=sms'), env, makeCtx());
  const body = await res.json();
  assert.equal(body.suppressed, false);
});

test('GET /api/v1/suppressions/check: missing channel is a real 400', async () => {
  const env = fakeD1();
  const res = await worker.fetch(req('GET', '/api/v1/suppressions/check?identifier=lead@acme.com'), env, makeCtx());
  assert.equal(res.status, 400);
});

test('unknown path returns a real 404', async () => {
  const env = fakeD1();
  const res = await worker.fetch(req('GET', '/nope'), env, makeCtx());
  assert.equal(res.status, 404);
});

// --- Consent (cross-venture data-sharing opt-in) - deliberately separate
// question from suppressions above. ---

test('POST /api/v1/consent: records a real grant and returns 201', async () => {
  const env = fakeD1();
  const res = await worker.fetch(
    req('POST', '/api/v1/consent', {
      identifier: 'lead@acme.com',
      scope: 'cross_venture_data_sharing',
      granted: true,
      source_venture: 'salesfactorai.com',
    }),
    env,
    makeCtx()
  );
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.recorded, true);
  assert.equal(body.consent.granted, true);
  assert.equal(env._consents.length, 1);
  assert.equal(env._consents[0].source_venture, 'salesfactorai.com');
});

test('POST /api/v1/consent: records a real decline (granted: false) as its own real state, not an error', async () => {
  const env = fakeD1();
  const res = await worker.fetch(
    req('POST', '/api/v1/consent', {
      identifier: 'lead@acme.com',
      scope: 'cross_venture_data_sharing',
      granted: false,
      source_venture: 'salesfactorai.com',
    }),
    env,
    makeCtx()
  );
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.consent.granted, false);
});

test('POST /api/v1/consent: missing identifier is a real 400', async () => {
  const env = fakeD1();
  const res = await worker.fetch(
    req('POST', '/api/v1/consent', { scope: 'cross_venture_data_sharing', granted: true, source_venture: 'salesfactorai.com' }),
    env,
    makeCtx()
  );
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.code, 'INVALID_INPUT');
});

test('POST /api/v1/consent: an invalid scope is rejected', async () => {
  const env = fakeD1();
  const res = await worker.fetch(
    req('POST', '/api/v1/consent', {
      identifier: 'lead@acme.com',
      scope: 'made_up_scope',
      granted: true,
      source_venture: 'salesfactorai.com',
    }),
    env,
    makeCtx()
  );
  assert.equal(res.status, 400);
});

test('POST /api/v1/consent: granted must be a real boolean, not a truthy string', async () => {
  const env = fakeD1();
  const res = await worker.fetch(
    req('POST', '/api/v1/consent', {
      identifier: 'lead@acme.com',
      scope: 'cross_venture_data_sharing',
      granted: 'yes',
      source_venture: 'salesfactorai.com',
    }),
    env,
    makeCtx()
  );
  assert.equal(res.status, 400);
});

test('POST /api/v1/consent: missing source_venture is a real 400', async () => {
  const env = fakeD1();
  const res = await worker.fetch(
    req('POST', '/api/v1/consent', { identifier: 'lead@acme.com', scope: 'cross_venture_data_sharing', granted: true }),
    env,
    makeCtx()
  );
  assert.equal(res.status, 400);
});

test('POST /api/v1/consent: recording the same (identifier, scope) twice upserts, not duplicates, and a later decision overrides an earlier one', async () => {
  const env = fakeD1();
  await worker.fetch(
    req('POST', '/api/v1/consent', {
      identifier: 'lead@acme.com',
      scope: 'cross_venture_data_sharing',
      granted: true,
      source_venture: 'salesfactorai.com',
    }),
    env,
    makeCtx()
  );
  const res2 = await worker.fetch(
    req('POST', '/api/v1/consent', {
      identifier: 'lead@acme.com',
      scope: 'cross_venture_data_sharing',
      granted: false,
      source_venture: 'weylandai.com',
    }),
    env,
    makeCtx()
  );
  assert.equal(res2.status, 201);
  assert.equal(env._consents.length, 1, 'UNIQUE(identifier, scope) must upsert, not append a duplicate row');
  assert.equal(env._consents[0].granted, 0, 'stored as SQLite INTEGER, same representation D1 itself uses');
  assert.equal(env._consents[0].source_venture, 'weylandai.com');
});

test('GET /api/v1/consent/check: a granted consent returns consented:true, reason:granted', async () => {
  const env = fakeD1();
  await worker.fetch(
    req('POST', '/api/v1/consent', {
      identifier: 'lead@acme.com',
      scope: 'cross_venture_data_sharing',
      granted: true,
      source_venture: 'salesfactorai.com',
    }),
    env,
    makeCtx()
  );
  const res = await worker.fetch(
    req('GET', '/api/v1/consent/check?identifier=lead%40acme.com&scope=cross_venture_data_sharing'),
    env,
    makeCtx()
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.consented, true);
  assert.equal(body.reason, 'granted');
  assert.equal(body.source_venture, 'salesfactorai.com');
});

test('GET /api/v1/consent/check: an explicit decline returns consented:false, reason:declined (not confused with no_record)', async () => {
  const env = fakeD1();
  await worker.fetch(
    req('POST', '/api/v1/consent', {
      identifier: 'lead@acme.com',
      scope: 'cross_venture_data_sharing',
      granted: false,
      source_venture: 'salesfactorai.com',
    }),
    env,
    makeCtx()
  );
  const res = await worker.fetch(
    req('GET', '/api/v1/consent/check?identifier=lead%40acme.com&scope=cross_venture_data_sharing'),
    env,
    makeCtx()
  );
  const body = await res.json();
  assert.equal(body.consented, false);
  assert.equal(body.reason, 'declined');
});

test('GET /api/v1/consent/check: fail-closed - an identifier with NO record at all returns consented:false, reason:no_record, never true', async () => {
  const env = fakeD1();
  const res = await worker.fetch(
    req('GET', '/api/v1/consent/check?identifier=never-asked%40acme.com&scope=cross_venture_data_sharing'),
    env,
    makeCtx()
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.consented, false);
  assert.equal(body.reason, 'no_record');
  assert.equal(body.source_venture, undefined, 'no_record must not fabricate attribution fields');
});

test('GET /api/v1/consent/check: missing scope is a real 400', async () => {
  const env = fakeD1();
  const res = await worker.fetch(req('GET', '/api/v1/consent/check?identifier=lead@acme.com'), env, makeCtx());
  assert.equal(res.status, 400);
});

test('GET /consent: renders a real HTML page with Allow/Decline, not a stub', async () => {
  const env = fakeD1();
  const res = await worker.fetch(
    req('GET', '/consent?identifier=lead%40acme.com&source_venture=salesfactorai.com&return_url=https%3A%2F%2Fsalesfactorai.com%2Fthanks'),
    env,
    makeCtx()
  );
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  const html = await res.text();
  assert.match(html, /lead@acme\.com/);
  assert.match(html, /salesfactorai\.com/);
  assert.match(html, /id="allow"/);
  assert.match(html, /id="decline"/);
  // No pre-checked/pre-selected state: neither button is disabled/checked by default.
  assert.doesNotMatch(html, /id="allow"[^>]*disabled/);
  assert.doesNotMatch(html, /id="decline"[^>]*disabled/);
});

test('GET /consent: missing identifier/source_venture is a real 400, not a broken page', async () => {
  const env = fakeD1();
  const res = await worker.fetch(req('GET', '/consent'), env, makeCtx());
  assert.equal(res.status, 400);
  assert.match(res.headers.get('content-type'), /text\/html/);
});

test('GET /dsar: renders a real self-service HTML form, not a stub', async () => {
  const env = fakeD1();
  const res = await worker.fetch(req('GET', '/dsar'), env, makeCtx());
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  const html = await res.text();
  assert.match(html, /id="identifier"/);
  assert.match(html, /id="sourceVenture"/);
  assert.match(html, /id="requestType"/);
  assert.match(html, /id="dsarForm"/);
  assert.match(html, /\/api\/v1\/dsar/);
});

// --- Trial entitlements (mascom/flagged_next_steps_backlog.json id
// conglomerate-wide-trial-invite-emails) ---

test('POST /api/v1/trials: creates a real pending entitlement', async () => {
  const env = fakeD1();
  const res = await worker.fetch(
    req('POST', '/api/v1/trials', {
      invite_token: 'tok_abc123',
      identifier: 'lead@acme.com',
      venture: 'weylandai.com',
      product: 'subx',
      trial_limit: { type: 'payloads', value: 10 },
      source_venture: 'salesfactorai.com',
    }),
    env,
    makeCtx()
  );
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.created, true);
  assert.equal(body.trial.status, 'pending');
  assert.equal(body.trial.remaining_value, 10);
  assert.equal(body.trial.activated_at, null, 'must NOT be activated at create time - only at claim time');
});

test('POST /api/v1/trials: rejects a duplicate invite_token rather than overwriting', async () => {
  const env = fakeD1();
  await worker.fetch(req('POST', '/api/v1/trials', {
    invite_token: 'tok_dup', identifier: 'a@b.com', venture: 'weylandai.com', product: 'subx',
    trial_limit: { type: 'payloads', value: 5 },
  }), env, makeCtx());
  const res = await worker.fetch(req('POST', '/api/v1/trials', {
    invite_token: 'tok_dup', identifier: 'a@b.com', venture: 'weylandai.com', product: 'subx',
    trial_limit: { type: 'payloads', value: 5 },
  }), env, makeCtx());
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.code, 'ALREADY_EXISTS');
});

test('POST /api/v1/trials: rejects an invalid trial_limit.type', async () => {
  const env = fakeD1();
  const res = await worker.fetch(req('POST', '/api/v1/trials', {
    invite_token: 'tok_bad', identifier: 'a@b.com', venture: 'weylandai.com', product: 'subx',
    trial_limit: { type: 'minutes', value: 5 },
  }), env, makeCtx());
  assert.equal(res.status, 400);
});

test('GET /api/v1/trials/:token: 404 for an unknown token', async () => {
  const env = fakeD1();
  const res = await worker.fetch(req('GET', '/api/v1/trials/nope'), env, makeCtx());
  assert.equal(res.status, 404);
});

test('POST /api/v1/trials/:token/consume: NOT_ACTIVATED before claim - a pending trial cannot be consumed', async () => {
  const env = fakeD1();
  await worker.fetch(req('POST', '/api/v1/trials', {
    invite_token: 'tok_pend', identifier: 'a@b.com', venture: 'weylandai.com', product: 'subx',
    trial_limit: { type: 'payloads', value: 3 },
  }), env, makeCtx());
  const res = await worker.fetch(req('POST', '/api/v1/trials/tok_pend/consume', {}), env, makeCtx());
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.reason, 'NOT_ACTIVATED');
});

test('POST /api/v1/trials/:token/claim then /consume: full real payload lifecycle down to exhaustion', async () => {
  const env = fakeD1();
  await worker.fetch(req('POST', '/api/v1/trials', {
    invite_token: 'tok_life', identifier: 'a@b.com', venture: 'weylandai.com', product: 'subx',
    trial_limit: { type: 'payloads', value: 2 }, source_venture: 'salesfactorai.com',
  }), env, makeCtx());

  const claimRes = await worker.fetch(req('POST', '/api/v1/trials/tok_life/claim', { granted: true }), env, makeCtx());
  assert.equal(claimRes.status, 200);
  const claimBody = await claimRes.json();
  assert.equal(claimBody.trial.status, 'active');
  assert.ok(claimBody.trial.activated_at, 'activated_at must be set at claim time');
  assert.equal(claimBody.consented.granted, true);
  assert.equal(env._consents.length, 1, 'claim must also record the real consent decision');

  // Re-claiming must be idempotent - not reset/extend the trial.
  const activatedAtFirst = claimBody.trial.activated_at;
  const reclaim = await worker.fetch(req('POST', '/api/v1/trials/tok_life/claim', { granted: false }), env, makeCtx());
  const reclaimBody = await reclaim.json();
  assert.equal(reclaimBody.trial.activated_at, activatedAtFirst, 'activation must not reset on a repeat claim');

  const consume1 = await worker.fetch(req('POST', '/api/v1/trials/tok_life/consume', {}), env, makeCtx());
  assert.equal(consume1.status, 200);
  const c1 = await consume1.json();
  assert.equal(c1.remaining, 1);

  const consume2 = await worker.fetch(req('POST', '/api/v1/trials/tok_life/consume', {}), env, makeCtx());
  const c2 = await consume2.json();
  assert.equal(c2.remaining, 0);
  assert.equal(c2.status, 'exhausted');

  const consume3 = await worker.fetch(req('POST', '/api/v1/trials/tok_life/consume', {}), env, makeCtx());
  assert.equal(consume3.status, 409);
  const c3 = await consume3.json();
  assert.equal(c3.ok, false);
  assert.equal(c3.reason, 'EXHAUSTED');
});

test('GET /claim: a real, live-verified AuthFor token with a pending trial renders the consent+claim page', async () => {
  const env = fakeD1();
  await worker.fetch(req('POST', '/api/v1/trials', {
    invite_token: 'tok_claimpage', identifier: 'lead@acme.com', venture: 'weylandai.com', product: 'subx',
    trial_limit: { type: 'payloads', value: 10 },
  }), env, makeCtx());

  const realFetch = global.fetch;
  global.fetch = async (u) => {
    if (String(u).includes('ephemeral/verify')) {
      return new Response(JSON.stringify({ id: 'tok_claimpage', upgraded: false }), { status: 200 });
    }
    return realFetch(u);
  };
  try {
    const res = await worker.fetch(
      req('GET', '/claim?token=tok_claimpage&return_to=https%3A%2F%2Fweylandai.com%2F'),
      env,
      makeCtx()
    );
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /id="allow"/);
    assert.match(html, /id="decline"/);
    assert.match(html, /subx/i);
  } finally {
    global.fetch = realFetch;
  }
});

test('GET /claim: an AuthFor-rejected (expired/invalid) token shows a real error, not a claim form', async () => {
  const env = fakeD1();
  await worker.fetch(req('POST', '/api/v1/trials', {
    invite_token: 'tok_expired', identifier: 'lead@acme.com', venture: 'weylandai.com', product: 'subx',
    trial_limit: { type: 'payloads', value: 10 },
  }), env, makeCtx());

  const realFetch = global.fetch;
  global.fetch = async (u) => {
    if (String(u).includes('ephemeral/verify')) {
      return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
    }
    return realFetch(u);
  };
  try {
    const res = await worker.fetch(req('GET', '/claim?token=tok_expired&return_to=https%3A%2F%2Fweylandai.com%2F'), env, makeCtx());
    assert.equal(res.status, 404);
    const html = await res.text();
    assert.doesNotMatch(html, /id="allow"/);
  } finally {
    global.fetch = realFetch;
  }
});

test('GET /claim: an already-claimed trial skips the consent form and offers a direct continue link', async () => {
  const env = fakeD1();
  await worker.fetch(req('POST', '/api/v1/trials', {
    invite_token: 'tok_already', identifier: 'lead@acme.com', venture: 'weylandai.com', product: 'subx',
    trial_limit: { type: 'payloads', value: 10 },
  }), env, makeCtx());
  await worker.fetch(req('POST', '/api/v1/trials/tok_already/claim', { granted: true }), env, makeCtx());

  const realFetch = global.fetch;
  global.fetch = async (u) => {
    if (String(u).includes('ephemeral/verify')) {
      return new Response(JSON.stringify({ id: 'tok_already', upgraded: false }), { status: 200 });
    }
    return realFetch(u);
  };
  try {
    const res = await worker.fetch(req('GET', '/claim?token=tok_already&return_to=https%3A%2F%2Fweylandai.com%2F'), env, makeCtx());
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.doesNotMatch(html, /id="allow"/);
    assert.match(html, /trial_token=tok_already/);
  } finally {
    global.fetch = realFetch;
  }
});

test('POST /api/v1/dsar: records a real request and returns 201', async () => {
  const env = fakeD1();
  const res = await worker.fetch(
    req('POST', '/api/v1/dsar', {
      identifier: 'lead@acme.com',
      request_type: 'deletion',
      source_venture: 'salesfactorai.com',
      details: 'Please delete all records tied to this email.',
    }),
    env,
    makeCtx()
  );
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.created, true);
  assert.equal(body.request.status, 'pending');
  assert.equal(body.request.identifier, 'lead@acme.com');
  assert.equal(env._dsar.length, 1);
});

test('POST /api/v1/dsar: missing identifier is a real 400', async () => {
  const env = fakeD1();
  const res = await worker.fetch(
    req('POST', '/api/v1/dsar', { request_type: 'access', source_venture: 'salesfactorai.com' }),
    env,
    makeCtx()
  );
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.code, 'INVALID_INPUT');
});

test('POST /api/v1/dsar: an invalid request_type is rejected', async () => {
  const env = fakeD1();
  const res = await worker.fetch(
    req('POST', '/api/v1/dsar', { identifier: 'lead@acme.com', request_type: 'sabotage', source_venture: 'salesfactorai.com' }),
    env,
    makeCtx()
  );
  assert.equal(res.status, 400);
});

test('GET /api/v1/dsar/:id: returns a real request by id', async () => {
  const env = fakeD1();
  const createRes = await worker.fetch(
    req('POST', '/api/v1/dsar', { identifier: 'lead@acme.com', request_type: 'access', source_venture: 'salesfactorai.com' }),
    env,
    makeCtx()
  );
  const { request: created } = await createRes.json();

  const res = await worker.fetch(req('GET', `/api/v1/dsar/${created.id}`), env, makeCtx());
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.request.id, created.id);
  assert.equal(body.request.status, 'pending');
});

test('GET /api/v1/dsar/:id: an unknown id is a real 404, not a silent empty result', async () => {
  const env = fakeD1();
  const res = await worker.fetch(req('GET', '/api/v1/dsar/does-not-exist'), env, makeCtx());
  assert.equal(res.status, 404);
});

test('GET /api/v1/dsar?identifier=: lists all real requests for that identifier, newest first', async () => {
  const env = fakeD1();
  await worker.fetch(req('POST', '/api/v1/dsar', { identifier: 'lead@acme.com', request_type: 'access', source_venture: 'salesfactorai.com' }), env, makeCtx());
  await worker.fetch(req('POST', '/api/v1/dsar', { identifier: 'lead@acme.com', request_type: 'deletion', source_venture: 'salesfactorai.com' }), env, makeCtx());
  await worker.fetch(req('POST', '/api/v1/dsar', { identifier: 'someone-else@acme.com', request_type: 'access', source_venture: 'salesfactorai.com' }), env, makeCtx());

  const res = await worker.fetch(req('GET', '/api/v1/dsar?identifier=lead@acme.com'), env, makeCtx());
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.requests.length, 2);
});

test('POST /api/v1/dsar/:id/resolve: records a real resolution outcome', async () => {
  const env = fakeD1();
  const createRes = await worker.fetch(
    req('POST', '/api/v1/dsar', { identifier: 'lead@acme.com', request_type: 'deletion', source_venture: 'salesfactorai.com' }),
    env,
    makeCtx()
  );
  const { request: created } = await createRes.json();

  const res = await worker.fetch(
    req('POST', `/api/v1/dsar/${created.id}/resolve`, { status: 'resolved', resolution_note: 'Deleted from salesfactorai.com CRM 2026-09-14.' }),
    env,
    makeCtx()
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.resolved, true);
  assert.equal(body.request.status, 'resolved');
  assert.equal(body.request.resolution_note, 'Deleted from salesfactorai.com CRM 2026-09-14.');
  assert.ok(body.request.resolved_at);
});

test('POST /api/v1/dsar/:id/resolve: an invalid status is rejected', async () => {
  const env = fakeD1();
  const createRes = await worker.fetch(
    req('POST', '/api/v1/dsar', { identifier: 'lead@acme.com', request_type: 'access', source_venture: 'salesfactorai.com' }),
    env,
    makeCtx()
  );
  const { request: created } = await createRes.json();

  const res = await worker.fetch(req('POST', `/api/v1/dsar/${created.id}/resolve`, { status: 'pending' }), env, makeCtx());
  assert.equal(res.status, 400);
});

test('POST /api/v1/dsar/:id/resolve: an unknown id is a real 404', async () => {
  const env = fakeD1();
  const res = await worker.fetch(req('POST', '/api/v1/dsar/does-not-exist/resolve', { status: 'resolved' }), env, makeCtx());
  assert.equal(res.status, 404);
});

test('GET /admin/dsar: no CONSENTA_ADMIN_TOKEN configured fails closed, not open', async () => {
  const env = fakeD1();
  const res = await worker.fetch(req('GET', '/admin/dsar'), env, makeCtx());
  assert.equal(res.status, 401);
});

test('GET /admin/dsar: wrong token is a real 401', async () => {
  const env = fakeD1();
  env.CONSENTA_ADMIN_TOKEN = 'right-token';
  const res = await worker.fetch(req('GET', '/admin/dsar?token=wrong-token'), env, makeCtx());
  assert.equal(res.status, 401);
});

test('GET /admin/dsar: correct token lists real outstanding requests, not a stub', async () => {
  const env = fakeD1();
  env.CONSENTA_ADMIN_TOKEN = 'right-token';
  const createRes = await worker.fetch(
    req('POST', '/api/v1/dsar', { identifier: 'lead@acme.com', request_type: 'deletion', source_venture: 'salesfactorai.com' }),
    env,
    makeCtx()
  );
  const { request: created } = await createRes.json();

  const res = await worker.fetch(req('GET', '/admin/dsar?token=right-token'), env, makeCtx());
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, new RegExp(created.id.slice(0, 8)));
  assert.match(html, /lead@acme\.com/);
});

test('GET /admin/dsar: correct token via Authorization header also works', async () => {
  const env = fakeD1();
  env.CONSENTA_ADMIN_TOKEN = 'right-token';
  const res = await worker.fetch(
    new Request('https://consenta.cc/admin/dsar', { headers: { Authorization: 'Bearer right-token' } }),
    env,
    makeCtx()
  );
  assert.equal(res.status, 200);
});

test('GET /admin/dsar: an already-resolved request does not show in the queue', async () => {
  const env = fakeD1();
  env.CONSENTA_ADMIN_TOKEN = 'right-token';
  const createRes = await worker.fetch(
    req('POST', '/api/v1/dsar', { identifier: 'lead@acme.com', request_type: 'access', source_venture: 'salesfactorai.com' }),
    env,
    makeCtx()
  );
  const { request: created } = await createRes.json();
  await worker.fetch(req('POST', `/api/v1/dsar/${created.id}/resolve`, { status: 'resolved' }), env, makeCtx());

  const res = await worker.fetch(req('GET', '/admin/dsar?token=right-token'), env, makeCtx());
  const html = await res.text();
  assert.doesNotMatch(html, new RegExp(created.id.slice(0, 8)));
  assert.match(html, /Nothing pending/);
});

test('POST /admin/dsar/:id/resolve: no token is a real 401, request stays pending', async () => {
  const env = fakeD1();
  env.CONSENTA_ADMIN_TOKEN = 'right-token';
  const createRes = await worker.fetch(
    req('POST', '/api/v1/dsar', { identifier: 'lead@acme.com', request_type: 'access', source_venture: 'salesfactorai.com' }),
    env,
    makeCtx()
  );
  const { request: created } = await createRes.json();

  const res = await worker.fetch(req('POST', `/admin/dsar/${created.id}/resolve`, { status: 'resolved' }), env, makeCtx());
  assert.equal(res.status, 401);
  assert.equal(env._dsar[0].status, 'pending');
});

test('POST /admin/dsar/:id/resolve: correct token resolves a real request', async () => {
  const env = fakeD1();
  env.CONSENTA_ADMIN_TOKEN = 'right-token';
  const createRes = await worker.fetch(
    req('POST', '/api/v1/dsar', { identifier: 'lead@acme.com', request_type: 'deletion', source_venture: 'salesfactorai.com' }),
    env,
    makeCtx()
  );
  const { request: created } = await createRes.json();

  const res = await worker.fetch(
    new Request(`https://consenta.cc/admin/dsar/${created.id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer right-token' },
      body: JSON.stringify({ status: 'resolved', resolution_note: 'Deleted from CRM.' }),
    }),
    env,
    makeCtx()
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.request.status, 'resolved');
  assert.equal(env._dsar[0].status, 'resolved');
});

test('POST /admin/dsar/:id/resolve: an unknown id is a real 404, not a silent success', async () => {
  const env = fakeD1();
  env.CONSENTA_ADMIN_TOKEN = 'right-token';
  const res = await worker.fetch(
    new Request('https://consenta.cc/admin/dsar/does-not-exist/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer right-token' },
      body: JSON.stringify({ status: 'resolved' }),
    }),
    env,
    makeCtx()
  );
  assert.equal(res.status, 404);
});
