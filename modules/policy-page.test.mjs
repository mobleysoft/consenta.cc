// node --test modules/policy-page.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { renderPolicyPage, VENTURE_POLICIES } from "./policy-page.js";

const terms = renderPolicyPage("weylandai.com", "terms");
const privacy = renderPolicyPage("weylandai.com", "privacy");
const plain = (html) => html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");

test("weylandai.com: both documents render", () => {
  assert.match(terms, /^<!doctype html>/);
  assert.match(privacy, /^<!doctype html>/);
  assert.match(terms, /<title>Terms of Service — WeylandAI<\/title>/);
  assert.match(privacy, /<title>Privacy Policy — WeylandAI<\/title>/);
});

test("weylandai.com: Argo LLC is the operator; the old entity is gone", () => {
  for (const html of [terms, privacy]) {
    assert.match(plain(html), /WeylandAI is operated by Argo LLC/);
    assert.doesNotMatch(html, /Mobley Helms/i);
  }
});

test("weylandai.com terms: the $100 offer, 30 days, no automatic charge, cut-off keeps the account", () => {
  const t = plain(terms);
  assert.match(t, /Your first submittal costs \$100, paid once/);
  assert.match(t, /30 days of every WeylandAI product/);
  assert.match(t, /we will not charge your card again unless you choose a plan/);
  assert.match(t, /Before the 30 days are up, WeylandAI asks you, in the product/);
  assert.match(t, /Your account stays, tied to your email address, with everything you made in it/);
  assert.match(t, /The offer can be used once per account/);
  assert.doesNotMatch(t, /renew automatically/i);
  assert.doesNotMatch(t, /account settings/i);
});

test("weylandai.com terms: plans, cancel in the account view, refunds by request", () => {
  const t = plain(terms);
  assert.match(t, /A plan starts only when you choose one/);
  assert.match(t, /once a month, in advance, until you cancel it/);
  assert.match(t, /cancel a plan at any time from your account in WeylandAI/);
  assert.match(t, /stays on until the end of the month you have already paid for, and it is not charged again/);
  assert.match(t, /does not refund a charge already made/);
  assert.match(t, /14 days of every WeylandAI product/);
});

test("weylandai.com: section anchors other owners link to", () => {
  for (const id of ["offer", "plans", "cancel", "refunds", "after-access", "contact"]) assert.match(terms, new RegExp(`<h2 id="${id}">`));
  for (const id of ["rights", "processors", "keep", "contact"]) assert.match(privacy, new RegExp(`<h2 id="${id}">`));
});

test("weylandai.com: contact addresses are working mailto links", () => {
  assert.match(terms, /<a href="mailto:support@weylandai\.com">support@weylandai\.com<\/a>/);
  assert.match(terms, /<a href="mailto:hello@weylandai\.com">hello@weylandai\.com<\/a>/);
  assert.match(privacy, /<a href="mailto:support@weylandai\.com">support@weylandai\.com<\/a>/);
  // "@weylandai.com addresses" (no local part) is not made into a link
  assert.doesNotMatch(privacy, /mailto:@/);
});

test("weylandai.com: canonical and cross-links point at weylandai.com", () => {
  assert.match(terms, /<link rel="canonical" href="https:\/\/weylandai\.com\/terms">/);
  assert.match(privacy, /<link rel="canonical" href="https:\/\/weylandai\.com\/privacy">/);
  assert.match(terms, /<a href="https:\/\/weylandai\.com\/privacy">WeylandAI Privacy Policy &rarr;<\/a>/);
  assert.match(privacy, /<a href="https:\/\/weylandai\.com\/terms">WeylandAI Terms of Service &rarr;<\/a>/);
  assert.match(terms, /<a class="home" href="https:\/\/weylandai\.com\/">/);
});

test("weylandai.com privacy: processors and data facts", () => {
  const p = plain(privacy);
  for (const name of ["Stripe", "Cloudflare", "Google", "AuthFor (authfor.com)", "MailguyAI", "vendyai", "consenta.cc"]) assert.ok(p.includes(name), name);
  assert.match(p, /keeps only a salted hash of it, never the password itself/);
  assert.match(p, /noted by manufacturer and model only/);
  assert.match(p, /We do not send your documents to any outside AI service/);
  assert.match(p, /Copies of the demo building made for visitors are deleted after 24 hours/);
});

test("unknown venture or document type: null", () => {
  assert.equal(renderPolicyPage("nope.example", "terms"), null);
  assert.equal(renderPolicyPage("weylandai.com", "cookies"), null);
});

test("registry text is escaped before links are made", () => {
  const saved = VENTURE_POLICIES["test.example"];
  VENTURE_POLICIES["test.example"] = {
    displayName: "T<b>", legalEntity: "E&Co", effectiveDate: "2026-01-01",
    documents: { terms: { title: "Terms", sections: [{ id: "x", heading: "H<i>", blocks: [{ p: "<script>alert(1)</script> a@b.co https://e.example/x?y=1" }] }] } },
  };
  try {
    const html = renderPolicyPage("test.example", "terms");
    assert.doesNotMatch(html, /<script>alert/);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.match(html, /<a href="mailto:a@b\.co">a@b\.co<\/a>/);
    assert.match(html, /<a href="https:\/\/e\.example\/x\?y=1" target="_blank" rel="noopener">/);
    assert.match(html, /T&lt;b&gt; Terms/);
    // no siteUrls: the cross-link stays relative to this host; the other document is absent
    assert.match(html, /href="\/policy\/test\.example\/privacy"/);
    assert.equal(renderPolicyPage("test.example", "privacy"), null);
  } finally {
    if (saved === undefined) delete VENTURE_POLICIES["test.example"]; else VENTURE_POLICIES["test.example"] = saved;
  }
});
