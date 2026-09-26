# consenta.cc /compliance-check — integration note

Written 2026-09-26, depth audit. Adds `GET /compliance-check` (public form)
and `POST /api/v1/compliance-check` (see `worker.js`,
`modules/compliance-rules.js`, `modules/compliance-check-page.js`).

## Why this, now

The 2026-09-25 depth audit recorded a real, honest `product_hunt_ready:
needs-work` verdict: the DSAR flow and `/health-card` are both real, but
both are adjacent utilities, not the venture's actual pitched core product
(a multi-jurisdiction compliance-automation platform). There was no
self-serve surface at all for the thing consenta.cc is actually supposed
to be. This venture's own `spec_draft` in `ventures.json` already named the
right scope: "needs one named jurisdiction/regulation to start with, not
all at once."

## What this is, and what it deliberately is not

A static, deterministic checklist lookup across four named regulations
(GDPR/EU, CCPA-CPRA/California, PIPEDA/Canada, LGPD/Brazil) and five data
categories (children's, health, biometric, financial, and the jurisdiction
base list). Every item is a widely-published, high-level summary fact
about the named regulation (the level of detail in any public
compliance-101 explainer), annotated with a real statutory/article
reference.

**It is not legal advice, not a rules engine that reasons about a specific
business's facts, and not exhaustive.** No LLM call, no invented
conclusions — the response is a lookup against a fixed table
(`modules/compliance-rules.js`), filtered by the caller's own selections.
Every response and the page itself carry the same disclaimer. This is the
same harm-class discipline `mascom/CLAUDE.md` already applies to the
wellness/trading clusters (informational only, explicitly scoped, never
claimed as a substitute for a real professional judgment call), applied
here to legal-adjacent content instead of medical/financial.

## Live endpoints (consenta.cc, additive routes `consenta.cc/compliance-check*`, `consenta.cc/api/v1/compliance-check*`, `consenta-cc-worker`)

- `GET /compliance-check` — public HTML form, jurisdiction + data-category
  checkboxes, renders results client-side from the API response.
- `POST /api/v1/compliance-check` — `{jurisdictions: string[], dataCategories?: string[]}`.
  `jurisdictions` must be non-empty and every key must exist in
  `JURISDICTIONS`; unknown keys are a real 400, not a silent skip. Returns
  `{checklist: [{jurisdiction_key, jurisdiction, items: [...]}], disclaimer}`.

No D1 table, no auth gate — nothing here is per-user state, so there's
nothing to store or protect beyond the existing trust model this file's
sibling endpoints already use.

## Real, honest scope left open

- Only 4 jurisdictions and 5 data-category modifiers exist. Adding another
  named jurisdiction means adding a real, individually-checked entry to
  `JURISDICTIONS` — never copy another jurisdiction's items and relabel.
- No linkage yet from the shared `mobley-venture-fleet-a` landing-page
  copy on consenta.cc's root page — that repo has an unrelated sandboxed
  task (`d295b112`) already pending Mobley's review as of this pass;
  adding a second concurrent edit to that same file risked exactly the
  class of shared-working-tree collision `AGENTS.md` incidents #4b/#4g
  document, so it was deliberately left for a follow-up pass once that
  task lands.
- Still not a jurisdiction-rules *engine* in the sense OneTrust/TrustArc
  actually sell (no per-business applicability logic, no audit trail, no
  automated obligation tracking over time) — a real, working first rung
  toward that, not the destination.
