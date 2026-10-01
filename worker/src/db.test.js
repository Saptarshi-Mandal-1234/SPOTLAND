import { describe, expect, it } from 'vitest';
import { testDb } from './test-db.js';
import { readCache, reserveProvider, writeCache } from './db';
describe('D1 SQL cache and global provider gates', () => {
  it('roundtrips JSON, updates entries, and expires cached data', async () => {
    const db = testDb(); await writeCache(db, 'place', [{ name: 'Chai' }], 100, 1000);
    expect(await readCache(db, 'place', 1001)).toEqual([{ name: 'Chai' }]);
    expect(await readCache(db, 'place', 1100)).toBeNull();
    await writeCache(db, 'place', [], 100, 1100); expect(await readCache(db, 'place', 1101)).toEqual([]);
  });
  it('atomically rejects requests inside the shared cooldown', async () => {
    const db = testDb(); expect(await reserveProvider(db, 'nominatim', 1500, 1000)).toBe(true);
    expect(await reserveProvider(db, 'nominatim', 1500, 1001)).toBe(false);
    expect(await reserveProvider(db, 'nominatim', 1500, 2500)).toBe(true);
  });
  it('treats corrupt JSON as a cache miss so a provider can recover', async () => {
    const db = testDb(); await db.prepare('INSERT INTO provider_cache (key, value, expires_at) VALUES (?, ?, ?)').bind('broken', '{bad', 2000).run();
    expect(await readCache(db, 'broken', 1000)).toBeNull();
    await writeCache(db, 'broken', { ok: true }, 1000, 1000); expect(await readCache(db, 'broken', 1001)).toEqual({ ok: true });
  });
});


