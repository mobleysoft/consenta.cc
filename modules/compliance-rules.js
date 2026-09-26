// consenta.cc /compliance-check — a real, narrow first slice of the
// venture's actual core promise (a rules engine tied to named
// jurisdictions/regulations), not another adjacent utility.
//
// Prior state (2026-09-25 depth audit's own product_hunt_ready verdict):
// a stranger arriving at consenta.cc had nothing to try that represented
// the pitched core product ("adaptive compliance automation... across
// multiple jurisdictions") - the DSAR form and /health-card are real, but
// both are adjacent utilities, not the compliance-rules engine itself.
// This venture's own spec_draft (ventures.json) already named the right
// starting scope: "needs one named jurisdiction/regulation to start with,
// not all at once."
//
// This is a static, deterministic checklist lookup - no LLM call, no
// invented legal conclusions, no personalized "you must" language. Every
// item below is a widely-published, high-level summary fact about the
// named regulation (the kind of thing any public compliance-101 explainer
// states), not case-specific advice. Same harm-class discipline
// mascom/CLAUDE.md already applies to the wellness/trading clusters
// (informational only, explicit scope, never claimed as a substitute for
// the real professional judgment call) - here that means "reference
// checklist," not "legal advice," stated plainly on every response and on
// the page itself.

export const JURISDICTIONS = {
  gdpr_eu: {
    label: 'GDPR (European Union)',
    items: [
      { requirement: 'Recognize data subject rights: access, rectification, erasure, restriction, portability, and objection.', reference: 'GDPR Arts. 15–21' },
      { requirement: 'Have a lawful basis (consent, contract, legal obligation, vital interests, public task, or legitimate interests) before processing personal data.', reference: 'GDPR Art. 6' },
      { requirement: 'Notify the relevant supervisory authority of a personal data breach within 72 hours of becoming aware of it, where feasible.', reference: 'GDPR Art. 33' },
      { requirement: 'Appoint a Data Protection Officer if you are a public authority, or your core activities involve large-scale systematic monitoring or large-scale processing of special-category data.', reference: 'GDPR Art. 37' },
      { requirement: 'Use an adequacy decision, Standard Contractual Clauses, or another approved safeguard before transferring personal data outside the EEA.', reference: 'GDPR Arts. 44–49' },
    ],
  },
  ccpa_ca: {
    label: 'CCPA/CPRA (California)',
    items: [
      { requirement: 'Recognize consumer rights to know, delete, correct, and opt out of the sale/sharing of personal information.', reference: 'Cal. Civ. Code §1798.100 et seq.' },
      { requirement: 'Provide a clear "Do Not Sell or Share My Personal Information" mechanism, or honor an opt-out preference signal (e.g. Global Privacy Control).', reference: 'Cal. Civ. Code §1798.135' },
      { requirement: 'Confirm whether your business meets the CCPA applicability thresholds (revenue, volume of consumer records, or revenue share from selling/sharing data) before assuming it applies.', reference: 'Cal. Civ. Code §1798.140' },
      { requirement: 'Report qualifying data breaches involving unencrypted personal information without unreasonable delay.', reference: 'Cal. Civ. Code §1798.82' },
    ],
  },
  pipeda_ca: {
    label: 'PIPEDA (Canada)',
    items: [
      { requirement: 'Follow the 10 Fair Information Principles, including accountability, identifying purposes, and limiting collection to what is needed.', reference: "PIPEDA Schedule 1" },
      { requirement: 'Obtain meaningful consent for the collection, use, or disclosure of personal information.', reference: 'PIPEDA s. 6.1' },
      { requirement: 'Report breaches posing a real risk of significant harm to both the Privacy Commissioner of Canada and affected individuals.', reference: "PIPEDA Breach of Security Safeguards Regulations" },
      { requirement: 'Give individuals a way to access their personal information and challenge its accuracy.', reference: 'PIPEDA Principle 9' },
    ],
  },
  lgpd_br: {
    label: 'LGPD (Brazil)',
    items: [
      { requirement: 'Establish a legal basis for processing (consent is one of several available bases, not the only one).', reference: 'LGPD Art. 7' },
      { requirement: 'Recognize data subject rights: confirmation of processing, access, correction, anonymization, deletion, and portability.', reference: 'LGPD Art. 18' },
      { requirement: 'Designate a person responsible for data protection (encarregado / DPO).', reference: 'LGPD Art. 41' },
      { requirement: 'Notify the ANPD (national data protection authority) of a security incident within a reasonable period.', reference: 'LGPD Art. 48' },
    ],
  },
};

export const DATA_CATEGORY_MODIFIERS = {
  childrens_data: {
    label: "Children's data",
    extra: {
      gdpr_eu: { requirement: 'Parental consent is required for information-society services offered directly to a child under 16 (member states may lower this to 13).', reference: 'GDPR Art. 8' },
      ccpa_ca: { requirement: 'Opt-in (not opt-out) consent is required to sell or share the personal information of a consumer known to be under 16.', reference: 'Cal. Civ. Code §1798.120(c)' },
      lgpd_br: { requirement: "Processing a child's data requires specific, highlighted consent from at least one parent or legal guardian.", reference: 'LGPD Art. 14' },
    },
  },
  health_data: {
    label: 'Health data',
    extra: {
      gdpr_eu: { requirement: 'Health data is a "special category" - processing is generally prohibited unless a specific Art. 9(2) exception applies.', reference: 'GDPR Art. 9' },
      ccpa_ca: { requirement: 'Health-related data commonly qualifies as "sensitive personal information," giving consumers a right to limit its use.', reference: 'Cal. Civ. Code §1798.121' },
    },
  },
  biometric_data: {
    label: 'Biometric data',
    extra: {
      gdpr_eu: { requirement: 'Biometric data used for unique identification is a "special category" under the same Art. 9 restriction as health data.', reference: 'GDPR Art. 9' },
      ccpa_ca: { requirement: 'Biometric information is classified as "sensitive personal information" with an associated right to limit its use.', reference: 'Cal. Civ. Code §1798.121' },
    },
  },
  financial_data: {
    label: 'Financial data',
    extra: {
      ccpa_ca: { requirement: "A consumer's financial account, debit/credit card number, or credentials are classified as sensitive personal information.", reference: 'Cal. Civ. Code §1798.121' },
    },
  },
};

export function isValidJurisdiction(key) {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(JURISDICTIONS, key);
}

export function isValidDataCategory(key) {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(DATA_CATEGORY_MODIFIERS, key);
}

// Deterministic, static-data lookup - no invented output, nothing computed
// beyond filtering/annotating the tables above by the caller's selections.
export function buildComplianceChecklist({ jurisdictions, dataCategories }) {
  const results = [];
  for (const jKey of jurisdictions) {
    const jurisdiction = JURISDICTIONS[jKey];
    if (!jurisdiction) continue;
    const items = jurisdiction.items.map((item) => ({ ...item, jurisdiction: jurisdiction.label, jurisdiction_key: jKey }));
    for (const catKey of dataCategories) {
      const modifier = DATA_CATEGORY_MODIFIERS[catKey];
      const extra = modifier && modifier.extra[jKey];
      if (extra) {
        items.push({ ...extra, jurisdiction: jurisdiction.label, jurisdiction_key: jKey, data_category: modifier.label });
      }
    }
    results.push({ jurisdiction_key: jKey, jurisdiction: jurisdiction.label, items });
  }
  return results;
}
