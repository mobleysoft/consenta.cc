// Minimal, real-enough in-memory D1 fake for consenta.cc's suppressions
// table - implements the actual upsert/select behavior the real SQL
// statements rely on (UNIQUE(identifier, channel) -> ON CONFLICT DO
// UPDATE), not stubbed return values.

export function fakeD1() {
  const suppressions = [];
  const consents = [];
  const trials = [];

  function findRow(identifier, channel) {
    return suppressions.find((s) => s.identifier === identifier && s.channel === channel) || null;
  }

  function findConsent(identifier, scope) {
    return consents.find((c) => c.identifier === identifier && c.scope === scope) || null;
  }

  function findTrial(id) {
    return trials.find((t) => t.id === id) || null;
  }

  const db = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async run() {
              if (sql.startsWith('INSERT INTO suppressions')) {
                const [id, identifier, channel, source_venture, reason, recorded_at] = args;
                const existing = findRow(identifier, channel);
                if (existing) {
                  // ON CONFLICT(identifier, channel) DO UPDATE
                  Object.assign(existing, { source_venture, reason, recorded_at });
                } else {
                  suppressions.push({ id, identifier, channel, source_venture, reason, recorded_at });
                }
              }
              if (sql.startsWith('INSERT INTO consents')) {
                const [id, identifier, scope, granted, source_venture, recorded_at] = args;
                const existing = findConsent(identifier, scope);
                if (existing) {
                  // ON CONFLICT(identifier, scope) DO UPDATE
                  Object.assign(existing, { granted, source_venture, recorded_at });
                } else {
                  consents.push({ id, identifier, scope, granted, source_venture, recorded_at });
                }
              }
              if (sql.startsWith('INSERT INTO trial_entitlements')) {
                const [id, identifier, venture, product, limit_type, limit_value, remaining_value, source_venture, created_at] = args;
                trials.push({
                  id, identifier, venture, product, limit_type, limit_value, remaining_value,
                  status: 'pending', activated_at: null, expires_at: null, source_venture, created_at,
                });
              }
              if (sql.startsWith("UPDATE trial_entitlements SET status = 'active'")) {
                const [activated_at, expires_at, id] = args;
                const t = findTrial(id);
                if (t) Object.assign(t, { status: 'active', activated_at, expires_at });
              }
              if (sql.startsWith("UPDATE trial_entitlements SET status = 'expired'")) {
                const [id] = args;
                const t = findTrial(id);
                if (t) t.status = 'expired';
              }
              if (sql.startsWith('UPDATE trial_entitlements SET remaining_value')) {
                const [remaining_value, status, id] = args;
                const t = findTrial(id);
                if (t) Object.assign(t, { remaining_value, status });
              }
              return { success: true };
            },
            async first() {
              if (sql.startsWith('SELECT identifier, channel, source_venture, reason, recorded_at FROM suppressions')) {
                const [identifier, channel] = args;
                return findRow(identifier, channel);
              }
              if (sql.startsWith('SELECT identifier, scope, granted, source_venture, recorded_at FROM consents')) {
                const [identifier, scope] = args;
                return findConsent(identifier, scope);
              }
              if (sql.includes('FROM trial_entitlements')) {
                const [id] = args;
                return findTrial(id);
              }
              return null;
            },
            async all() {
              return { results: [] };
            },
          };
        },
      };
    },
  };

  return { CONSENTA_DB: db, _suppressions: suppressions, _consents: consents, _trials: trials };
}
