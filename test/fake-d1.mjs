// Minimal, real-enough in-memory D1 fake for consenta.cc's suppressions
// table - implements the actual upsert/select behavior the real SQL
// statements rely on (UNIQUE(identifier, channel) -> ON CONFLICT DO
// UPDATE), not stubbed return values.

export function fakeD1() {
  const suppressions = [];

  function findRow(identifier, channel) {
    return suppressions.find((s) => s.identifier === identifier && s.channel === channel) || null;
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
              return { success: true };
            },
            async first() {
              if (sql.startsWith('SELECT identifier, channel, source_venture, reason, recorded_at FROM suppressions')) {
                const [identifier, channel] = args;
                return findRow(identifier, channel);
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

  return { CONSENTA_DB: db, _suppressions: suppressions };
}
