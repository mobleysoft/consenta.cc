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
