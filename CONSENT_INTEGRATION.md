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

## Intended integration point (NOT built in this task)

AuthFor's ephemeral-invite/magic-link claim flow (in-progress, separate
repo: `/Users/johnmobley/authfor.com`) is the natural moment a real person
first shows up with an identifier attached to a specific venture — exactly
when this consent question should be asked, before their info is treated as
shareable across the conglomerate.

The intended real flow, once AuthFor's side is ready:

1. A person clicks an ephemeral invite / magic link for venture X.
2. Before AuthFor completes the claim, it redirects to
   `consenta.cc/consent?identifier=<their identifier>&source_venture=X&return_url=<AuthFor's claim-completion URL>`.
3. They see the real consent notice above and pick Allow or Decline.
4. consenta.cc records the decision via `POST /api/v1/consent` and redirects
   back to AuthFor's `return_url` (with `?consent=granted|declined`
   appended), which then completes the claim.
5. Any venture that later wants to know if it's allowed to treat that
   identifier's info as shareable calls
   `GET /api/v1/consent/check?identifier=&scope=cross_venture_data_sharing`
   and treats anything other than `consented: true` as "not consented" —
   fail-closed, same as this file's endpoints already guarantee.

This task's job was only to make consenta.cc's own side of that contract
real and live — the endpoints above are deployed and verified today. Wiring
AuthFor's claim step to actually redirect through `/consent` is separate,
still-in-progress work in `authfor.com` and is intentionally not touched
here.
