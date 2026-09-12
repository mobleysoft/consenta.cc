# consenta.cc consent system — integration note

Written 2026-09-11, alongside the real build of `/api/v1/consent`,
`/api/v1/consent/check`, and the `/consent` HTML page (see `worker.js`,
`modules/consents-store.js`, `migrations/0002_consents.sql`).

## What this is

A single, cross-venture, real record of whether a specific person has
explicitly agreed to have their info **retained and shared across more than
one MobCorp/Mobleysoft venture** (scope `cross_venture_data_sharing`). This
is deliberately separate from the suppression list built earlier the same
session (`/api/v1/suppressions`, `migrations/0001_suppressions.sql`), which
tracks explicit opt-OUT of being *contacted* on a channel. A person can be
consented to sharing while opted out of contact, or reachable while declining
sharing — the two tables and endpoints are intentionally never merged.

Default is fail-closed: `GET /api/v1/consent/check` returns
`consented: false` for both an explicit decline and a missing record. Only a
real `granted: true` row makes it return `true`.

## Live endpoints (consenta.cc, additive routes, `consenta-cc-worker`)

- `POST /api/v1/consent` — `{identifier, scope, granted, source_venture}`, upserts.
- `GET /api/v1/consent/check?identifier=&scope=` — `{consented, reason}` where
  `reason` is `granted` | `declined` | `no_record`.
- `GET /consent?identifier=&source_venture=&return_url=` — the real,
  honest, one-screen consent notice a person sees and answers directly.
  Both Allow and Decline call `POST /api/v1/consent` before redirecting to
  `return_url` (if provided) with `?consent=granted` or `?consent=declined`
  appended.

## Integration point: BUILT 2026-09-12 (was "not built in this task" above, as of 2026-09-11)

Built as part of the conglomerate-wide-trial-invite-emails capability
(`mascom/flagged_next_steps_backlog.json`), which needed exactly this
integration point plus a real trial-entitlement ledger. Rather than
modifying AuthFor's own claim flow to redirect through `/consent` (the
originally-sketched design above), the actual real flow puts consenta.cc
itself directly in the claim path: the pitch email's claim link points at
consenta.cc's own new `GET /claim` (not directly at AuthFor), so the
consent question and the trial-activation moment happen together in the
same request — see `migrations/0003_trials.sql`, `modules/trials-store.js`,
and `worker.js`'s `/api/v1/trials*` and `/claim` routes.

The real flow, live today:

1. A person clicks the claim link in a real pitch email
   (`mascom/trial-invite-batch.mjs` composes it) - the link is
   `consenta.cc/claim?token=<AuthFor ephemeral invite token>&return_to=<venture's own real page>`.
2. `GET /claim` first calls AuthFor's real `POST /api/v1/ephemeral/verify`
   server-side to confirm the token is genuine and unexpired - never
   trusts the URL alone. An invalid/expired token gets a real error page,
   not a claim form.
3. It looks up the matching `trial_entitlements` row (created earlier by
   the batch script via `POST /api/v1/trials`, status `pending`). If
   already claimed (not `pending`), skips straight to a "continue to your
   trial" link instead of asking consent twice.
4. Otherwise renders the real consent+claim question (same fail-closed
   `cross_venture_data_sharing` scope as `/consent` above - not a second,
   divergent mechanism). Allow/Decline both POST to
   `/api/v1/trials/:token/claim`.
5. That endpoint atomically (a) records the real consent decision via the
   same `recordConsent()` this file's `/consent` route uses, and (b) calls
   `activateTrial()` - THIS is the real claim moment: the trial's
   clock/counter starts here, not when the invite was created or the email
   was sent. Idempotent - re-visiting an already-claimed link does not
   reset the trial.
6. The browser is redirected to `return_to` with `?trial_token=<token>`
   appended. weylandai.com's own landing page (`index.html`) was extended
   to honor this - see that repo's `ephemeralToken()` - so the visitor
   resumes AS the identity-bound invited session (not a fresh anonymous
   one), and `requireProductAccess()` (`src/lib/auth.js`) now calls this
   worker's `/api/v1/trials/:token/consume` to enforce the real
   payload/time limit for any ephemeral session that has one, closing a
   gap that file's own comments had documented as deliberately unmetered.

`GET /api/v1/consent/check?identifier=&scope=cross_venture_data_sharing`
remains the real, unchanged, fail-closed way any venture checks whether an
identifier's info is shareable - untouched by this integration.

Full request-level verification (real curl round-trips against production,
not assumed) is recorded in this session's report; see
`mascom/flagged_next_steps_backlog.json`'s `conglomerate-wide-trial-invite-emails`
entry for the current end-to-end status and what's still blocked (a real
send requires `MAILGUY_API_KEY` in the environment, not present as of this
writing).
