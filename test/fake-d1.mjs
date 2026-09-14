// Minimal, real-enough in-memory D1 fake for consenta.cc's suppressions
// table - implements the actual upsert/select behavior the real SQL
// statements rely on (UNIQUE(identifier, channel) -> ON CONFLICT DO
// UPDATE), not stubbed return values.

export function fakeD1() {
  const suppressions = [];
  const consents = [];
  const trials = [];
  const dsarRequests = [];

  function findRow(identifier, channel) {
    return suppressions.find((s) => s.identifier === identifier && s.channel === channel) || null;
  }

  function findConsent(identifier, scope) {
    return consents.find((c) => c.identifier === identifier && c.scope === scope) || null;
  }

  function findTrial(id) {
    return trials.find((t) => t.id === id) || null;
  }

  function findDsar(id) {
    return dsarRequests.find((d) => d.id === id) || null;
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
              if (sql.startsWith('INSERT INTO dsar_requests')) {
                const [id, identifier, request_type, source_venture, details, created_at] = args;
                dsarRequests.push({
                  id, identifier, request_type, source_venture, details,
                  status: 'pending', created_at, resolved_at: null, resolution_note: null,
                });
              }
              if (sql.startsWith('UPDATE dsar_requests SET status')) {
                const [status, resolved_at, resolution_note, id] = args;
                const d = findDsar(id);
                if (d) Object.assign(d, { status, resolved_at, resolution_note });
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
              if (sql.startsWith('SELECT * FROM dsar_requests')) {
                const [id] = args;
                return findDsar(id);
              }
              if (sql.includes('FROM trial_entitlements')) {
                const [id] = args;
                return findTrial(id);
              }
              return null;
            },
            async all() {
              if (sql.startsWith('SELECT * FROM dsar_requests WHERE identifier')) {
                const [identifier] = args;
                return { results: dsarRequests.filter((d) => d.identifier === identifier).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)) };
              }
              return { results: [] };
            },
          };
        },
      };
    },
  };

  return { CONSENTA_DB: db, _suppressions: suppressions, _consents: consents, _trials: trials, _dsar: dsarRequests };
}
