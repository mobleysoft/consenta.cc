// consenta.cc /policy/:venture/:type — real privacy policy / terms of
// service pages, shared conglomerate infrastructure rather than each
// venture writing (or more likely, never writing) its own.
//
// Built 2026-10-03 after a direct finding: weylandai.com had NO privacy
// policy or terms of service anywhere, despite taking real Stripe
// payments and running real account signup. Per direct instruction, this
// content is meant to live here (consenta.cc, the conglomerate's real
// consent/compliance venture) rather than as static boilerplate on each
// product's own domain - so a second venture that needs the same thing
// gets a real, working integration instead of copy-pasted legal text.
//
// VENTURE_POLICIES is a registry, not a template engine with placeholder
// text - every fact in weylandai.com's entry below was verified against
// real code this same session (what data gets collected, which real
// third parties are involved, what the real DSAR/account-deletion path
// is), not invented to sound complete. A venture added here with
// unverified facts would defeat the entire point.

export const VENTURE_POLICIES = {
  "weylandai.com": {
    displayName: "WeylandAI",
    legalEntity: "Mobley Helms Systems LP",
    domain: "weylandai.com",
    contactEmail: "enterprise@weylandai.com",
    effectiveDate: "2026-10-03",
    accountDataCollected: [
      "Email address and name, for any account you create.",
      "A hashed password (we never store your password in plain text).",
      "Billing details are collected and stored by Stripe, not by us directly — see \"Payment processing\" below.",
    ],
    guestDataCollected: [
      "If you use the product without creating an account, we issue an anonymous guest session (no email or personal information required) that expires automatically after 30 days.",
      "You can convert a guest session into a permanent account at any time; doing so carries your existing session's activity into the new account rather than starting over.",
    ],
    contentDataCollected: [
      "Project documents you upload (e.g. PDF drawings, door schedules, submittal packages) are stored so the product can process and return them to you.",
      "Derived data our products generate from what you upload — extracted hardware schedules, matched catalog citations, generated proposals — is stored the same way.",
    ],
    cookiesAndStorage: [
      "A session cookie (weyland_session) when you're signed in to a real account, used only to keep you signed in.",
      "A guest session token, stored in your browser's sessionStorage/localStorage, used only to identify your anonymous session.",
      "No third-party advertising or tracking cookies.",
    ],
    thirdParties: [
      { name: "Stripe", purpose: "Payment processing for subscriptions. We never see or store your full card number." },
      { name: "AuthFor (authfor.com)", purpose: "Identity and sign-in, including the anonymous guest-session system described above. A sibling Mobley Helms Systems company." },
      { name: "Cloudflare", purpose: "Hosting, database, and file storage infrastructure for the product itself." },
      { name: "consenta.cc", purpose: "This page, and the data-access/deletion request system linked below. Also a sibling Mobley Helms Systems company." },
    ],
    dataRights: "You can request a copy of your data, ask us to delete it, or request it in a portable format at any time, whether you have a permanent account or only ever used a guest session.",
  },
};

function esc(s) {
  return String(s == null ? "" : s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
}

function pageShell(title, bodyHtml) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root { --bg:#f6f4ef; --panel:#fff; --ink:#1c2a26; --muted:#5c6b66; --line:#d8ddd8; --accent:#00695C; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif; line-height:1.6; }
  .wrap { max-width:720px; margin:0 auto; padding:2.5rem 1.25rem 5rem; }
  h1 { font-size:1.6rem; margin:0 0 .3rem; }
  .sub { color:var(--muted); font-size:.88rem; margin-bottom:2rem; }
  h2 { font-size:1.1rem; margin:2rem 0 .6rem; }
  p, li { font-size:.95rem; color:#2a3a35; }
  ul { padding-left:1.3rem; }
  .card { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:1.5rem 1.75rem; }
  .tp-row { display:flex; gap:.6rem; margin:.5rem 0; }
  .tp-row b { flex:none; min-width:150px; }
  a { color:var(--accent); }
  .cta { display:inline-block; margin-top:.5rem; padding:.6rem 1.1rem; background:var(--accent); color:#fff; text-decoration:none; border-radius:7px; font-size:.88rem; font-weight:600; }
  .nav-link { font-size:.85rem; }
</style>
</head>
<body>
<div class="wrap">
${bodyHtml}
</div>
</body>
</html>`;
}

function renderPrivacy(slug, v) {
  const body = `
<h1>${esc(v.displayName)} Privacy Policy</h1>
<div class="sub">Effective ${esc(v.effectiveDate)} &middot; ${esc(v.legalEntity)} &middot; hosted at consenta.cc, the conglomerate's real consent &amp; compliance infrastructure</div>
<div class="card">
<h2>What we collect, if you create an account</h2>
<ul>${v.accountDataCollected.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>

<h2>What we collect, if you don't create an account</h2>
<ul>${v.guestDataCollected.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>

<h2>Project content you give us</h2>
<ul>${v.contentDataCollected.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>

<h2>Cookies and browser storage</h2>
<ul>${v.cookiesAndStorage.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>

<h2>Who else sees this data</h2>
${v.thirdParties.map((t) => `<div class="tp-row"><b>${esc(t.name)}</b><span>${esc(t.purpose)}</span></div>`).join("")}

<h2>Your rights</h2>
<p>${esc(v.dataRights)}</p>
<a class="cta" href="https://consenta.cc/dsar">Request access, deletion, or a copy of your data &rarr;</a>

<h2>Contact</h2>
<p>Questions about this policy: <a href="mailto:${esc(v.contactEmail)}">${esc(v.contactEmail)}</a></p>
</div>
<p class="nav-link"><a href="/policy/${esc(slug)}/terms">View Terms of Service &rarr;</a></p>
</div>`;
  return pageShell(`Privacy Policy — ${v.displayName}`, body);
}

function renderTerms(slug, v) {
  const body = `
<h1>${esc(v.displayName)} Terms of Service</h1>
<div class="sub">Effective ${esc(v.effectiveDate)} &middot; ${esc(v.legalEntity)}</div>
<div class="card">
<h2>The service</h2>
<p>${esc(v.displayName)} is operated by ${esc(v.legalEntity)}. You may use it with a guest session (no account required, automatically expires after 30 days) or a permanent account you create with an email and password.</p>

<h2>Payment</h2>
<p>Paid subscriptions are billed through Stripe. We don't store your full payment card details. Subscriptions renew automatically until canceled; see your account settings or contact us to cancel.</p>

<h2>Your content</h2>
<p>Documents and project data you upload remain yours. We store and process them only to provide the service back to you — generating extractions, matches, and proposals from what you give us.</p>

<h2>Acceptable use</h2>
<p>Don't use the service to violate the law, infringe someone else's rights, or attempt to disrupt or gain unauthorized access to our systems or other users' data.</p>

<h2>Guest sessions</h2>
<p>A guest session is a real, usable identity with no signup required. It expires automatically after 30 days of being unclaimed. You can convert it into a permanent account at any time without losing what you've already done.</p>

<h2>Termination</h2>
<p>You may stop using the service, or delete your account, at any time. We may suspend or terminate access for violation of these terms.</p>

<h2>Changes</h2>
<p>We'll update the effective date above if these terms change materially.</p>

<h2>Contact</h2>
<p><a href="mailto:${esc(v.contactEmail)}">${esc(v.contactEmail)}</a></p>
</div>
<p class="nav-link"><a href="/policy/${esc(slug)}/privacy">View Privacy Policy &rarr;</a></p>
</div>`;
  return pageShell(`Terms of Service — ${v.displayName}`, body);
}

export function renderPolicyPage(ventureSlug, type) {
  const v = VENTURE_POLICIES[ventureSlug];
  if (!v) return null;
  if (type === "privacy") return renderPrivacy(ventureSlug, v);
  if (type === "terms") return renderTerms(ventureSlug, v);
  return null;
}
