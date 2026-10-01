import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { afterEach } from 'vitest';

const databases = [];
export function testDb() {
  const sqlite = new DatabaseSync(':memory:'); databases.push(sqlite);
  for (const file of ['0001_provider_cache.sql', '0002_events.sql', '0003_crowd.sql', '0004_venues.sql', '0005_accounts.sql', '0006_live_shares.sql', '0007_sos.sql', '0008_trips.sql', '0009_reviews.sql', '0010_review_photos.sql']) sqlite.exec(readFileSync(new URL('../migrations/' + file, import.meta.url), 'utf8'));
  return { async batch(statements) { sqlite.exec('BEGIN'); try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec('COMMIT'); return results; } catch (e) { sqlite.exec('ROLLBACK'); throw e; } }, prepare(query) {
    let values = [];
    return { bind(...args) { values = args; return this; }, async first() { return sqlite.prepare(query).get(...values) ?? null; }, async all() { return { results: sqlite.prepare(query).all(...values) }; }, async run() { return sqlite.prepare(query).run(...values); } };
  } };
}
afterEach(() => { databases.splice(0).forEach(db => db.close()); });




