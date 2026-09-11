// Minimal, real-enough in-memory D1 fake for consenta.cc's suppressions
// table - implements the actual upsert/select behavior the real SQL
// statements rely on (UNIQUE(identifier, channel) -> ON CONFLICT DO
// UPDATE), not stubbed return values.

export function fakeD1() {
  const suppressions = [];
  const consents = [];

  function findRow(identifier, channel) {
    return suppressions.find((s) => s.identifier === identifier && s.channel === channel) || null;
  }

  function findConsent(identifier, scope) {
    return consents.find((c) => c.identifier === identifier && c.scope === scope) || null;
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

  return { CONSENTA_DB: db, _suppressions: suppressions, _consents: consents };
}
