# consenta.cc DSAR (data subject request) intake — integration note

Written 2026-09-13, alongside the real build of `/api/v1/dsar`,
`/api/v1/dsar/:id`, `/api/v1/dsar/:id/resolve` (see `worker.js`,
`modules/dsar-store.js`, `migrations/0004_dsar_requests.sql`).

## What this is, and what it deliberately is not

This is the first real piece of consenta.cc's actual claimed purpose
(`ventures.json`'s `subsumes`: OneTrust, TrustArc, Privitar, BigID,
WireWheel — all of which sell data subject access/deletion/portability
request handling as a core feature) beyond suppression/consent tracking.

**It is intake and status tracking only.** There is no jurisdiction rules
engine, no automated fulfillment (nothing here actually deletes a record in
another venture's system), and no regulator reporting. A real request lands
here, is checkable by identifier, and gets marked `resolved`/`rejected` with
a real note by whoever actually did the work. Claiming more than that would
repeat the exact overclaiming class `AGENTS.md`/`mascom/CLAUDE.md` exist to
catch — this file states the honest scope on purpose.

This is a separate, third concern from `suppressions` (opt-out of contact),
`consents` (opt-in to cross-venture data sharing), and `trial_entitlements`
(trial usage) — a DSAR is a request to exercise a legal right (see, export,
or delete one's own data), not any of those three questions.

## Live endpoints (consenta.cc, additive route `consenta.cc/api/v1/dsar*`, `consenta-cc-worker`)

- `POST /api/v1/dsar` — `{identifier, request_type, source_venture, details?}`,
  `request_type` is one of `access` | `deletion` | `portability`. Creates a
  new `pending` request.
- `GET /api/v1/dsar/:id` — real status of one request.
- `GET /api/v1/dsar?identifier=` — every request on file for an identifier,
  newest first. This is the real, checkable "what's on file about me"
  surface a person or the venture that collected their info can use.
- `POST /api/v1/dsar/:id/resolve` — `{status, resolution_note?}`, `status`
  is `resolved` | `rejected`. Records that a real person actually did the
  work; not a status the system can reach on its own.

No auth on these endpoints yet — same trust model as every other endpoint
in this worker (suppressions, consent, trials): whoever has the URL/id can
read or resolve. Every write is logged (`console.log`, visible in
`wrangler tail`) for the same reason.

## Live-verified 2026-09-13 (depth audit)

Full round-trip against production, not assumed: `POST /api/v1/dsar` → 201
with a real `pending` row; `GET /api/v1/dsar/:id` → 200 with the same row;
`GET /api/v1/dsar?identifier=` → 200 listing it; `POST .../resolve` → 200
with `status: "resolved"` and a real `resolved_at`; an unknown id on both
GET and resolve → real 404; an invalid `request_type` → real 400. The
verification probe row was deleted from production D1 immediately after
(`DELETE FROM dsar_requests WHERE identifier='depth-audit-probe@example.com'`)
so no test data is left behind. `worker.test.mjs`'s full suite (42 tests:
suppressions, consent, trials, claim, dsar) passes 42/42 against the local
fake-D1 replica.

## Real next step

No caller creates a DSAR request yet — this is intake infrastructure, not
a wired end-to-end flow. The honest next rung: a real intake form (a
`/dsar` HTML page, same pattern as `/consent`) so an actual person can file
a request themselves, rather than only a server-to-server `POST`. Not built
in this pass — flagging it rather than building a form with nothing real
behind it yet.

## Update, 2026-09-13: `/dsar` self-service form shipped and linked

The form named above is real and live (`GET /dsar`), and — as of a
2026-09-20 `mobley-venture-fleet-a` commit (`ea3d965`) — actually linked
from consenta.cc's own public venture page, closing the "reachable but
undiscoverable" gap this venture's `ventures.json` `next_step` had been
carrying since 2026-09-17.

## Update, 2026-09-21 (depth audit): admin queue for resolving requests

The remaining real gap once intake worked both ways (server-to-server and
self-service): `resolveDsarRequest()` had no caller except a raw
`POST /api/v1/dsar/:id/resolve` — there was no way for an actual person to
see what's outstanding and act on it without hand-crafting API calls. Added
`GET /admin/dsar` (lists every `pending`/`in_progress` request, oldest
first) and `POST /admin/dsar/:id/resolve` (the authenticated resolve
action the queue page's own UI calls) — see `modules/dsar-store.js`'s
`listPendingDsarRequests()` and `worker.js`'s `isAdminAuthorized()`.

This is the first auth-gated surface in this worker — every other endpoint
here documents an intentional no-auth trust model, but an internal queue
of real people's compliance requests is a different case, so it fails
CLOSED: a request without a valid `CONSENTA_ADMIN_TOKEN` (via
`Authorization: Bearer` or `?token=`) gets a real 401, and if the secret
isn't configured at all, access is denied rather than left open. The
existing unauthenticated `POST /api/v1/dsar/:id/resolve` was deliberately
left unchanged (additive, not a replacement) in case a trusted
server-to-server caller already relies on it.

Live-verified 2026-09-21 against production, not assumed: created a real
probe DSAR request, confirmed it appeared in `GET /admin/dsar` with the
correct token and not without one (401 with no token, 401 with a wrong
token), resolved it through `POST /admin/dsar/:id/resolve`, confirmed it
dropped out of the pending queue and shows `status: "resolved"` via
`GET /api/v1/dsar/:id`, then deleted the probe row from production D1
(`DELETE FROM dsar_requests WHERE identifier='depth-audit-admin-probe@example.com'`)
so no test data was left behind. `worker.test.mjs`: 51/51 passing (43
prior + 8 new). The `CONSENTA_ADMIN_TOKEN` Cloudflare secret is set (name
only recorded here, per this estate's credential doctrine — never a
literal value in any file); whoever operates this queue for real should
set their own known value via `wrangler secret put CONSENTA_ADMIN_TOKEN`
rather than assume one is already usable, since this pass rotated it
during live verification and did not persist the final value anywhere.
