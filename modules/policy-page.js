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
// text: each venture's entry carries its own documents, section by section,
// and every statement in them must be true of that venture's real code and
// real setup. A venture added here with unverified facts would defeat the
// entire point.
//
// 2026-10-07 (weylandai.com rewritten): John's decisions of that morning -
// Argo LLC, the only extant legal entity, is the operator customers see; the
// first submittal costs $100 once and comes with 30 days of every product,
// with no automatic charge; plans are charged only when the customer chooses
// one; access ending keeps the account and its work. The entry was
// rewritten against the code of that day (weylandai.com repo: platform
// entitlements TRIAL_DAYS 14, AuthFor's 30-day guest sessions, passwords
// held by AuthFor as salted hashes, the weyland_session cookie, the
// manufacturer+model-only miss log, the 24-hour demo-copy sweep, no outside
// AI service in any product worker; the payments contract in
// plan/evidence/weylandai_contracts.md for cancel-at-period-end). The old
// text named Mobley Helms Systems LP, promised automatic renewal and sent
// cancellations to a setting that did not exist and to an address that
// received no mail. The addresses named now (support@, hello@) forward to a
// real inbox (Cloudflare Email Routing, 2026-10-07).
//
// Where the documents are read: weylandai.com/terms and weylandai.com/privacy
// (weyland-cutsheetx-worker reaches this worker through a service binding),
// and here at /policy/weylandai.com/terms and /privacy. siteUrls makes the
// canonical link and the cross-links point at the venture's own addresses.
//
// Text blocks: {p: "..."} a paragraph, {ul: ["...", ...]} a list,
// {rows: [[name, what], ...]} a two-column list. Text is HTML-escaped; then
// email addresses become mailto links and https:// addresses become links
// (both matched on the escaped text, so no markup can be injected).

const WEYLANDAI_SUPPORT = "support@weylandai.com";
const WEYLANDAI_HELLO = "hello@weylandai.com";

export const VENTURE_POLICIES = {
  "weylandai.com": {
    displayName: "WeylandAI",
    legalEntity: "Argo LLC",
    domain: "weylandai.com",
    homeUrl: "https://weylandai.com/",
    siteUrls: { terms: "https://weylandai.com/terms", privacy: "https://weylandai.com/privacy" },
    contactEmail: WEYLANDAI_SUPPORT,
    generalEmail: WEYLANDAI_HELLO,
    effectiveDate: "2026-10-07",
    effectiveDateText: "7 October 2026",
    documents: {
      terms: {
        title: "Terms of Service",
        sections: [
          {
            id: "who",
            heading: "Who you are dealing with",
            blocks: [
              { p: "WeylandAI (weylandai.com) is operated by Argo LLC. In these terms, \"we\" and \"us\" mean Argo LLC, and \"you\" means the person using WeylandAI, or the business they use it for. Using WeylandAI, or paying for it, means you accept these terms." },
            ],
          },
          {
            id: "free",
            heading: "What is free",
            blocks: [
              {
                ul: [
                  "Without an account you can paste a door or hardware schedule and see each line matched to the manufacturer's catalogue page, with the citation, and you can search the cut-sheet Finder. These tools stay free.",
                  "Using WeylandAI without an account gives your browser an anonymous guest session. It needs no email address and ends by itself after 30 days.",
                  "A free account, made with your email address, includes 14 days of every WeylandAI product. We ask for no card and charge nothing; the 14 days simply end.",
                ],
              },
            ],
          },
          {
            id: "offer",
            heading: "Your first submittal: $100, with 30 days of every product",
            blocks: [
              {
                ul: [
                  "Your first submittal costs $100, paid once. It comes with 30 days of every WeylandAI product, counted from when your payment goes through.",
                  "It is a single payment. It does not renew and it never turns into a subscription by itself: we will not charge your card again unless you choose a plan.",
                  "Before the 30 days are up, WeylandAI asks you, in the product, whether you want a plan.",
                  "If you have not chosen a plan when the 30 days end, the products the offer unlocked stop. Your account stays, tied to your email address, with everything you made in it; choose a plan at any time and you carry on where you left off. The free tools stay open to you.",
                  "The offer can be used once per account.",
                ],
              },
            ],
          },
          {
            id: "plans",
            heading: "Plans",
            blocks: [
              {
                ul: [
                  "A plan starts only when you choose one and pay for it inside WeylandAI. Its price, in US dollars, and what it includes are shown before you pay.",
                  "A plan is charged when you choose it and then once a month, in advance, until you cancel it.",
                  "Stripe processes every payment. We never see or keep your full card number.",
                ],
              },
            ],
          },
          {
            id: "cancel",
            heading: "Cancelling, your card and your invoices",
            blocks: [
              {
                ul: [
                  "You can cancel a plan at any time from your account in WeylandAI. The same place lets you change your card and see and download your invoices.",
                  "A cancelled plan stays on until the end of the month you have already paid for, and it is not charged again. You can change your mind before that date.",
                  "If you cannot get into your account, write to " + WEYLANDAI_SUPPORT + " and we will cancel the plan for you.",
                ],
              },
            ],
          },
          {
            id: "refunds",
            heading: "Refunds",
            blocks: [
              { p: "Cancelling stops future charges; it does not refund a charge already made. If you think you were charged by mistake, or you want to ask for a refund, write to " + WEYLANDAI_SUPPORT + "." },
            ],
          },
          {
            id: "after-access",
            heading: "Your work, and what happens when access ends",
            blocks: [
              {
                ul: [
                  "What you upload (drawings, door and hardware schedules, other project documents) and what WeylandAI makes from it (matches, submittal packages, takeoffs, proposals) is yours. We store it and work on it only to provide WeylandAI to you.",
                  "When a free trial, the offer's 30 days or a plan ends, we keep your account and your work. The paid products stop until you choose a plan; the free tools stay.",
                  "You can ask us to delete your account and your work at any time; the Privacy Policy says how.",
                ],
              },
            ],
          },
          {
            id: "citations",
            heading: "Checking what WeylandAI tells you",
            blocks: [
              { p: "WeylandAI points each match to the manufacturer's own catalogue page or price book, with the page cited, so that you can check it. Check the cited page before you rely on a match or a price: manufacturers change their products and their prices." },
            ],
          },
          {
            id: "use",
            heading: "Fair use",
            blocks: [
              {
                ul: [
                  "Do not use WeylandAI to break the law, to infringe anyone's rights, or to get into or disrupt our systems or other people's data.",
                  "Upload only documents you are allowed to use.",
                  "We may suspend or close an account that breaks these rules.",
                ],
              },
            ],
          },
          {
            id: "changes",
            heading: "Changes to these terms",
            blocks: [{ p: "When these terms change, the date at the top changes with them." }],
          },
          {
            id: "contact",
            heading: "Contact",
            blocks: [
              {
                ul: [
                  "Your account, billing, cancellations and refunds: " + WEYLANDAI_SUPPORT,
                  "Anything else: " + WEYLANDAI_HELLO,
                ],
              },
              { p: "WeylandAI is operated by Argo LLC." },
            ],
          },
        ],
      },
      privacy: {
        title: "Privacy Policy",
        sections: [
          {
            id: "summary",
            heading: "In short",
            blocks: [
              { p: "WeylandAI is operated by Argo LLC. It keeps what it needs to work for you: your email address, your account and plan, and the documents you give it. We do not sell your data, and WeylandAI shows no advertising. You can have a copy of your data, or have it deleted, at any time." },
            ],
          },
          {
            id: "guest",
            heading: "If you use WeylandAI without an account",
            blocks: [
              {
                ul: [
                  "AuthFor, our sign-in service, gives your browser an anonymous guest session. It needs no email address or name, and it ends after 30 days.",
                  "What you paste is matched on our servers to answer you. A line that matches nothing is noted by manufacturer and model only, so that the catalogue can grow; nothing about you is kept with it.",
                  "Your browser keeps your guest session and your pasted matches in its own storage, so a reload keeps them.",
                ],
              },
            ],
          },
          {
            id: "account",
            heading: "If you create an account",
            blocks: [
              {
                ul: [
                  "Your email address, a display name (the part of your email address before the @, unless you give another) and a company name if you give one.",
                  "Your password is held by AuthFor, our sign-in service, which keeps only a salted hash of it, never the password itself.",
                  "Your plan, when it started and when it ends, and how much you have used (for example, how many submittals you have made).",
                  "A cookie named weyland_session keeps you signed in; your browser's own storage keeps your sign-in token.",
                ],
              },
            ],
          },
          {
            id: "payments",
            heading: "If you pay",
            blocks: [
              {
                ul: [
                  "Stripe collects your card details and processes the payment. We never see or keep your full card number.",
                  "We keep a record of what you bought, when and for how much, Stripe's references to the payment, and when you accepted the Terms of Service.",
                ],
              },
            ],
          },
          {
            id: "documents",
            heading: "Your project documents",
            blocks: [
              {
                ul: [
                  "The drawings, schedules and other documents you upload, and what WeylandAI makes from them (extracted schedules, matches with their citations, submittal packages, takeoffs, proposals), are stored so that WeylandAI can give them back to you.",
                  "WeylandAI's own software reads them: on Cloudflare's servers, for some steps in your own browser, and for some steps on a computer the WeylandAI team runs. We do not send your documents to any outside AI service.",
                ],
              },
            ],
          },
          {
            id: "visits",
            heading: "Visits",
            blocks: [
              {
                ul: [
                  "Our servers record visits (the page, the time, your network (IP) address and your browser type) to count use and to stop abuse, such as too many searches from one network.",
                  "Cloudflare Web Analytics counts visits in aggregate, without cookies.",
                  "No advertising or tracking cookies are used.",
                ],
              },
            ],
          },
          {
            id: "processors",
            heading: "Who else handles your data",
            blocks: [
              {
                rows: [
                  ["Stripe", "Payments."],
                  ["Cloudflare", "Hosting, databases and file storage; the browser our servers use to read uploaded drawings; sending WeylandAI's emails and delivering mail sent to @weylandai.com addresses; aggregate visit counts."],
                  ["Google", "Mail you send to " + WEYLANDAI_HELLO + ", " + WEYLANDAI_SUPPORT + " or enterprise@weylandai.com is delivered to our team's Gmail inbox."],
                  ["AuthFor (authfor.com)", "Sign-in and guest sessions, and the sign-in and password emails. Run by the same team as WeylandAI."],
                  ["MailguyAI", "Sends AuthFor's emails, through Cloudflare. Run by the same team as WeylandAI."],
                  ["vendyai", "Receives Stripe's notices about your payments (for example a renewal or a failed payment) and passes them to WeylandAI. Run by the same team as WeylandAI."],
                  ["consenta.cc", "Hosts the text of this policy and of the Terms of Service. Run by the same team as WeylandAI."],
                ],
              },
            ],
          },
          {
            id: "keep",
            heading: "How long we keep it",
            blocks: [
              {
                ul: [
                  "Your account and your work stay until you ask us to delete them, including after a free trial, the offer's 30 days or a plan ends, so that choosing a plan later picks up where you left off.",
                  "Guest sessions end after 30 days. Copies of the demo building made for visitors are deleted after 24 hours.",
                  "If we delete your account at your request, records of payments may be kept where the law requires it.",
                ],
              },
            ],
          },
          {
            id: "rights",
            heading: "A copy of your data, or deleting it",
            blocks: [
              { p: "You can ask for a copy of your data (also in a portable format), ask us to correct it, or ask us to delete it, whether you have an account or only used a guest session. Write to " + WEYLANDAI_SUPPORT + " from the email address on your account, or, for a guest session, tell us what you used and when." },
            ],
          },
          {
            id: "contact",
            heading: "Contact",
            blocks: [
              { ul: ["Privacy questions and requests: " + WEYLANDAI_SUPPORT, "Anything else: " + WEYLANDAI_HELLO] },
              { p: "WeylandAI is operated by Argo LLC." },
            ],
          },
        ],
      },
    },
  },
};

function esc(s) {
  return String(s == null ? "" : s).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Escaped text in, the same text with email addresses and https:// addresses
// made into links. The patterns only match characters that escaping leaves
// as they are, so no markup can come from the text itself.
function linkify(escaped) {
  return escaped
    .replace(/https:\/\/[A-Za-z0-9.\-\/_%?=#~+]*[A-Za-z0-9\/_%=#~+]/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`)
    .replace(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g, (m) => `<a href="mailto:${m}">${m}</a>`);
}

function text(s) {
  return linkify(esc(s));
}

function renderBlock(b) {
  if (b.p) return `<p>${text(b.p)}</p>`;
  if (b.ul) return `<ul>${b.ul.map((x) => `<li>${text(x)}</li>`).join("")}</ul>`;
  if (b.rows) return b.rows.map(([name, what]) => `<div class="tp-row"><b>${esc(name)}</b><span>${text(what)}</span></div>`).join("");
  return "";
}

function pageShell({ title, canonical, homeUrl, displayName, bodyHtml }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ""}
<script>
  // Inside another page's frame (the product's own overlay), that page has
  // the navigation: the home link hides.
  (function () { var f = true; try { f = window.self !== window.top; } catch (e) {} if (f) document.documentElement.className += " framed"; })();
</script>
<style>
  :root { --bg:#f6f4ef; --panel:#fff; --ink:#1c2a26; --muted:#5c6b66; --line:#d8ddd8; --accent:#00695C; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif; line-height:1.6; }
  .wrap { max-width:720px; margin:0 auto; padding:2rem 1.25rem 4rem; }
  .home { display:inline-block; margin-bottom:1.25rem; font-size:.9rem; font-weight:600; color:var(--accent); text-decoration:none; }
  .framed .home { display:none; }
  h1 { font-size:1.6rem; margin:0 0 .3rem; }
  .sub { color:var(--muted); font-size:.88rem; margin-bottom:1.5rem; }
  h2 { font-size:1.1rem; margin:1.8rem 0 .5rem; scroll-margin-top:1rem; }
  h2:first-child { margin-top:0; }
  p, li { font-size:.95rem; color:#2a3a35; }
  ul { padding-left:1.3rem; }
  li { margin:.3rem 0; }
  .card { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:1.5rem 1.75rem; }
  .tp-row { display:flex; gap:.6rem; margin:.5rem 0; flex-wrap:wrap; }
  .tp-row b { flex:none; min-width:150px; }
  .tp-row span { flex:1 1 280px; }
  a { color:var(--accent); overflow-wrap:anywhere; }
  .nav-link { font-size:.9rem; margin-top:1.25rem; }
  @media (max-width:480px) { .card { padding:1.1rem 1rem; } }
</style>
</head>
<body>
<div class="wrap">
${homeUrl ? `<a class="home" href="${esc(homeUrl)}">&larr; ${esc(displayName)}</a>` : ""}
${bodyHtml}
</div>
</body>
</html>`;
}

function otherDocumentUrl(slug, v, type) {
  const other = type === "terms" ? "privacy" : "terms";
  return (v.siteUrls && v.siteUrls[other]) || `/policy/${encodeURIComponent(slug)}/${other}`;
}

function renderDocument(slug, v, type) {
  const doc = v.documents[type];
  const other = type === "terms" ? "privacy" : "terms";
  const otherTitle = v.documents[other] ? v.documents[other].title : other === "terms" ? "Terms of Service" : "Privacy Policy";
  const body = `
<h1>${esc(v.displayName)} ${esc(doc.title)}</h1>
<div class="sub">Effective ${esc(v.effectiveDateText || v.effectiveDate)} &middot; ${esc(v.displayName)} is operated by ${esc(v.legalEntity)}</div>
<div class="card">
${doc.sections.map((s) => `<h2 id="${esc(s.id)}">${esc(s.heading)}</h2>\n${s.blocks.map(renderBlock).join("\n")}`).join("\n\n")}
</div>
<p class="nav-link"><a href="${esc(otherDocumentUrl(slug, v, type))}">${esc(v.displayName)} ${esc(otherTitle)} &rarr;</a></p>`;
  return pageShell({
    title: `${doc.title} — ${v.displayName}`,
    canonical: v.siteUrls && v.siteUrls[type],
    homeUrl: v.homeUrl,
    displayName: v.displayName,
    bodyHtml: body,
  });
}

export function renderPolicyPage(ventureSlug, type) {
  const v = VENTURE_POLICIES[ventureSlug];
  if (!v || !v.documents) return null;
  if (type !== "privacy" && type !== "terms") return null;
  if (!v.documents[type]) return null;
  return renderDocument(ventureSlug, v, type);
}
