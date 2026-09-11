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
