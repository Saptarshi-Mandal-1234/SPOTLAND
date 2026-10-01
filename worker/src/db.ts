export interface Statement {
  bind(...values: (string | number)[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
export interface Database { prepare(query: string): Statement; batch?(statements: Statement[]): Promise<unknown[]> }
export async function readCache(db: Database, key: string, now = Date.now()): Promise<unknown | null> {
  const row = await db.prepare('SELECT value FROM provider_cache WHERE key = ? AND expires_at > ?').bind(key, now).first<{ value: string }>();
  if (!row) return null;
  try { return JSON.parse(row.value); } catch { return null; }
}
export async function writeCache(db: Database, key: string, value: unknown, ttl: number, now = Date.now()) {
  await db.prepare('DELETE FROM provider_cache WHERE expires_at <= ?').bind(now).run();
  await db.prepare('INSERT INTO provider_cache (key, value, expires_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, expires_at=excluded.expires_at').bind(key, JSON.stringify(value), now + ttl).run();
}
export async function reserveProvider(db: Database, name: string, interval: number, now = Date.now()): Promise<boolean> {
  const row = await db.prepare('INSERT INTO provider_gates (name, next_at) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET next_at=excluded.next_at WHERE provider_gates.next_at <= ? RETURNING name').bind(name, now + interval, now).first();
  return row !== null;
}
