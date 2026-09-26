// consenta.cc /compliance-check — public self-serve page for the real
// jurisdiction-rules checklist in ./compliance-rules.js. See that file's
// header comment for why this exists and its scope discipline.

import { JURISDICTIONS, DATA_CATEGORY_MODIFIERS } from './compliance-rules.js';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function complianceCheckPageHtml() {
  const jurisdictionInputs = Object.entries(JURISDICTIONS)
    .map(([key, j]) => `<label class="chk"><input type="checkbox" name="jurisdiction" value="${key}"> ${escapeHtml(j.label)}</label>`)
    .join('\n    ');
  const categoryInputs = Object.entries(DATA_CATEGORY_MODIFIERS)
    .map(([key, c]) => `<label class="chk"><input type="checkbox" name="dataCategory" value="${key}"> ${escapeHtml(c.label)}</label>`)
    .join('\n    ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Compliance checklist — consenta.cc</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; max-width: 640px; margin: 6vh auto; padding: 0 24px; color: #1a1a1a; line-height: 1.5; }
  h1 { font-size: 1.4rem; }
  p { color: #333; }
  fieldset { border: 1px solid #ddd; border-radius: 10px; padding: 14px 16px; margin: 18px 0; }
  legend { font-weight: 600; padding: 0 6px; font-size: 0.9rem; }
  .chk { display: block; font-weight: 400; margin: 6px 0; font-size: 0.95rem; }
  button { margin-top: 20px; width: 100%; padding: 14px 16px; font-size: 1rem; border-radius: 8px; border: 1px solid #111; background: #111; color: #fff; cursor: pointer; }
  button:disabled { opacity: 0.6; cursor: default; }
  .disclaimer { margin-top: 18px; padding: 12px 14px; background: #fff2df; border: 1px solid #e8c98f; border-radius: 8px; font-size: 0.85rem; color: #8a4b00; }
  #results { margin-top: 24px; }
  .jgroup { margin-bottom: 18px; }
  .jgroup h2 { font-size: 1.05rem; margin-bottom: 6px; }
  .item { padding: 10px 0; border-top: 1px solid #eee; font-size: 0.92rem; }
  .item:first-of-type { border-top: none; }
  .ref { color: #666; font-size: 0.8rem; display: block; margin-top: 3px; }
  .cat { color: var(--accent, #00695C); font-weight: 600; }
  #status.error { color: #b00020; font-weight: 600; }
</style>
</head>
<body>
  <h1>Compliance checklist</h1>
  <p>
    Pick the jurisdictions you operate in and the kinds of personal data you
    handle. This returns a real, fixed reference checklist of commonly
    published high-level requirements under each named regulation - not a
    personalized assessment of your specific business.
  </p>
  <form id="checkForm">
    <fieldset>
      <legend>Jurisdictions</legend>
      ${jurisdictionInputs}
    </fieldset>
    <fieldset>
      <legend>Data categories you handle (optional)</legend>
      ${categoryInputs}
    </fieldset>
    <button id="submitBtn" type="submit">Show checklist</button>
  </form>
  <div id="status"></div>
  <div id="results"></div>
  <p class="disclaimer">
    <strong>Not legal advice.</strong> This is a general-awareness reference
    checklist based on publicly available summaries of these regulations.
    It is not exhaustive, does not consider your specific facts, and is not
    a substitute for advice from qualified counsel.
  </p>
<script>
(function () {
  var form = document.getElementById('checkForm');
  var submitBtn = document.getElementById('submitBtn');
  var statusEl = document.getElementById('status');
  var resultsEl = document.getElementById('results');

  function checkedValues(name) {
    var out = [];
    var els = form.querySelectorAll('input[name="' + name + '"]:checked');
    for (var i = 0; i < els.length; i++) out.push(els[i].value);
    return out;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var jurisdictions = checkedValues('jurisdiction');
    if (jurisdictions.length === 0) {
      statusEl.className = 'error';
      statusEl.textContent = 'Pick at least one jurisdiction.';
      return;
    }
    submitBtn.disabled = true;
    statusEl.className = '';
    statusEl.textContent = 'Looking up...';
    resultsEl.innerHTML = '';
    fetch('/api/v1/compliance-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jurisdictions: jurisdictions, dataCategories: checkedValues('dataCategory') }),
    })
      .then(function (res) { return res.json().then(function (body) { return { ok: res.ok, body: body }; }); })
      .then(function (result) {
        submitBtn.disabled = false;
        if (!result.ok) {
          statusEl.className = 'error';
          statusEl.textContent = (result.body && result.body.error) || 'Something went wrong.';
          return;
        }
        statusEl.textContent = '';
        var html = '';
        result.body.checklist.forEach(function (group) {
          html += '<div class="jgroup"><h2>' + escapeHtml(group.jurisdiction) + '</h2>';
          group.items.forEach(function (item) {
            html += '<div class="item">' + escapeHtml(item.requirement);
            if (item.data_category) html += ' <span class="cat">(' + escapeHtml(item.data_category) + ')</span>';
            html += '<span class="ref">' + escapeHtml(item.reference) + '</span></div>';
          });
          html += '</div>';
        });
        resultsEl.innerHTML = html;
      })
      .catch(function () {
        submitBtn.disabled = false;
        statusEl.className = 'error';
        statusEl.textContent = 'Something went wrong. Please try again.';
      });
  });
})();
</script>
</body>
</html>`;
}
