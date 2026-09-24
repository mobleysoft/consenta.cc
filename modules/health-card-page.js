// consenta.cc /health-card — patient-controlled portable health card.
//
// Zero-knowledge by construction: all data lives in the URL fragment
// (everything after '#'), which browsers never send to any server per the
// URL spec — no fetch, no form POST, no D1 write. The server literally
// cannot see what a user enters here. Same real pattern this estate already
// proved on pandorachat.cc (client-side AES-256-GCM, key never leaves the
// URL fragment) — reused here for the same reason: honest zero-storage
// sharing beats a fake "secure backend" for something this sensitive.
//
// This is explicitly NOT a medical record, NOT HIPAA-covered (no PHI ever
// touches a server or a database), and NOT clinically verified. It's a
// portable note the person controls and chooses to show a provider.

export const HEALTH_CARD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>consenta.cc — Portable Health Card</title>
<style>
  :root { --bg:#f6f4ef; --panel:#fff; --ink:#1c2a26; --muted:#5c6b66; --line:#d8ddd8; --accent:#00695C; --warn:#8a4b00; --warnbg:#fff2df; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif; line-height:1.5; }
  .wrap { max-width:640px; margin:0 auto; padding:2rem 1.25rem 4rem; }
  h1 { font-size:1.4rem; margin:0 0 .3rem; }
  .sub { color:var(--muted); font-size:.92rem; margin-bottom:1.5rem; }
  .disclaimer { background:var(--warnbg); border:1px solid #e8c98f; color:var(--warn); border-radius:8px; padding:.9rem 1.1rem; font-size:.85rem; margin-bottom:1.5rem; }
  .disclaimer strong { display:block; margin-bottom:.25rem; }
  form, .card { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:1.25rem; }
  label { display:block; font-size:.82rem; font-weight:600; color:var(--muted); margin:.9rem 0 .3rem; }
  label:first-of-type { margin-top:0; }
  input, textarea { width:100%; padding:.6rem .7rem; border:1px solid var(--line); border-radius:7px; font-size:.95rem; font-family:inherit; }
  textarea { min-height:70px; resize:vertical; }
  button { margin-top:1.3rem; width:100%; padding:.75rem; border:none; border-radius:7px; background:var(--accent); color:#fff; font-size:.95rem; font-weight:600; cursor:pointer; }
  button.secondary { background:#eef2f0; color:var(--ink); margin-top:.6rem; }
  .field-row { display:grid; grid-template-columns:1fr 1fr; gap:.75rem; }
  .card h2 { margin:0 0 1rem; font-size:1.15rem; }
  .card dl { display:grid; grid-template-columns:130px 1fr; gap:.5rem 1rem; margin:0; }
  .card dt { color:var(--muted); font-size:.8rem; text-transform:uppercase; letter-spacing:.03em; padding-top:.1rem; }
  .card dd { margin:0; white-space:pre-wrap; }
  .share-box { margin-top:1.25rem; }
  .share-box input { font-size:.8rem; color:var(--muted); }
  .copied { color:var(--accent); font-size:.82rem; margin-top:.4rem; display:none; }
  @media print { .no-print { display:none !important; } body { background:#fff; } .card { border:none; padding:0; } }
</style>
</head>
<body>
<div class="wrap">
  <h1>Portable health card</h1>
  <p class="sub">A card you fill out, control, and carry with you — nothing you type here is ever sent to or stored on any server.</p>

  <div class="disclaimer">
    <strong>Not a medical record.</strong>
    This is not verified by any clinician, not HIPAA-covered, and not a substitute for your actual medical records. You are solely responsible for what you enter here and for keeping it current. In a real emergency, call 911 — do not rely on this page as your only source of information.
  </div>

  <div id="form-view">
    <form id="card-form">
      <label>Name</label>
      <input type="text" id="f-name" placeholder="Your name">

      <div class="field-row">
        <div>
          <label>Date of birth</label>
          <input type="text" id="f-dob" placeholder="MM/DD/YYYY">
        </div>
        <div>
          <label>Blood type (if known)</label>
          <input type="text" id="f-blood" placeholder="e.g. O+">
        </div>
      </div>

      <label>Allergies</label>
      <textarea id="f-allergies" placeholder="Medications, foods, materials..."></textarea>

      <label>Current medications</label>
      <textarea id="f-meds" placeholder="Name, dose, frequency"></textarea>

      <label>Conditions / diagnoses you'd want a provider to know</label>
      <textarea id="f-conditions"></textarea>

      <label>Emergency contact</label>
      <input type="text" id="f-contact" placeholder="Name and phone number">

      <label>Care preferences / notes</label>
      <textarea id="f-notes" placeholder="Anything else — advance directives, preferred hospital, etc."></textarea>

      <button type="submit">Generate my card</button>
    </form>
  </div>

  <div id="card-view" style="display:none">
    <div class="card">
      <h2 id="c-name">—</h2>
      <dl id="c-fields"></dl>
    </div>

    <div class="share-box no-print">
      <label>Your private link (copy and save it — this page can't recover it for you)</label>
      <input type="text" id="share-link" readonly onclick="this.select()">
      <div class="copied" id="copied-note">Copied.</div>
      <button class="secondary" onclick="copyLink()">Copy link</button>
      <button class="secondary" onclick="window.print()">Print this card</button>
      <button class="secondary" onclick="startOver()">Start a new card</button>
    </div>
  </div>
</div>

<script>
function b64encode(obj) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
}
function b64decode(str) {
  return JSON.parse(decodeURIComponent(escape(atob(str))));
}

function fieldsToDL(data) {
  const rows = [
    ['Date of birth', data.dob],
    ['Blood type', data.blood],
    ['Allergies', data.allergies],
    ['Current medications', data.meds],
    ['Conditions', data.conditions],
    ['Emergency contact', data.contact],
    ['Notes', data.notes],
  ];
  return rows
    .filter(([, v]) => v && v.trim())
    .map(([label, v]) => \`<dt>\${label}</dt><dd>\${v.replace(/</g,'&lt;')}</dd>\`)
    .join('');
}

function renderCard(data) {
  document.getElementById('form-view').style.display = 'none';
  document.getElementById('card-view').style.display = 'block';
  document.getElementById('c-name').textContent = data.name || 'Health card';
  document.getElementById('c-fields').innerHTML = fieldsToDL(data);
  document.getElementById('share-link').value = location.origin + location.pathname + '#' + b64encode(data);
}

function startOver() {
  location.hash = '';
  location.reload();
}

function copyLink() {
  const el = document.getElementById('share-link');
  el.select();
  navigator.clipboard && navigator.clipboard.writeText(el.value).then(() => {
    const n = document.getElementById('copied-note');
    n.style.display = 'block';
    setTimeout(() => n.style.display = 'none', 2000);
  });
}

document.getElementById('card-form').addEventListener('submit', function (e) {
  e.preventDefault();
  const data = {
    name: document.getElementById('f-name').value,
    dob: document.getElementById('f-dob').value,
    blood: document.getElementById('f-blood').value,
    allergies: document.getElementById('f-allergies').value,
    meds: document.getElementById('f-meds').value,
    conditions: document.getElementById('f-conditions').value,
    contact: document.getElementById('f-contact').value,
    notes: document.getElementById('f-notes').value,
  };
  history.replaceState(null, '', '#' + b64encode(data));
  renderCard(data);
});

// If a card is already in the URL fragment (someone opened a shared link), show it directly.
(function () {
  if (location.hash && location.hash.length > 1) {
    try {
      renderCard(b64decode(location.hash.slice(1)));
    } catch (e) {
      // Malformed/unreadable fragment - fall through to the empty form, don't error out.
    }
  }
})();
</script>
</body>
</html>`;
