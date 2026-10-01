import { expect, test } from 'vitest';
import { testDb } from './test-db';
import { cleanupExpiredData } from './expiry-cleanup';

test('scheduled sweeps delete expired safety records, cascade dependents and preserve live shares', async () => {
  const DB = testDb(), past = Date.now() - 3600000, future = Date.now() + 86400000;
  await DB.prepare('INSERT INTO devices VALUES (?, ?, ?, ?, ?)').bind('owner', future, 'ttnfv', past, 'synthetic-subscription').run();
  await DB.prepare('INSERT INTO devices(id,expires_at) VALUES (?,?)').bind('expired', past).run();
  for (const [id, expiry] of [['old', past], ['live', future]]) {
    await DB.prepare('INSERT INTO live_shares VALUES (?,?,?,?,?,?,?,?)').bind(id, id + '-hash', 'owner', 0, 0, 0, past, expiry).run();
  }
  await DB.prepare('INSERT INTO sos_alerts VALUES (?,?,?,?,?,?,?)').bind('alert', 'owner', 'ttnfv', 'hidden', past, past, 0).run();
  await DB.prepare('INSERT INTO sos_reports VALUES (?,?)').bind('alert', 'owner').run();
  await DB.prepare('INSERT INTO sos_help VALUES (?,?)').bind('alert', 'owner').run();
  await DB.prepare('INSERT INTO push_deliveries VALUES (?,?,?,?,?)').bind('alert', 'owner', 'failed', 1, past).run();
  await cleanupExpiredData({ DB, ALLOWED_ORIGIN: 'https://example.test' });
  expect((await DB.prepare('SELECT id FROM live_shares').all()).results).toEqual([{ id: 'live' }]);
  expect(await DB.prepare("SELECT id FROM devices WHERE id='expired'").first()).toBeNull();
  expect(await DB.prepare("SELECT geohash,push_sub,nearby_expires_at FROM devices WHERE id='owner'").first()).toEqual({ geohash: null, push_sub: null, nearby_expires_at: 0 });
  for (const table of ['sos_alerts', 'sos_reports', 'sos_help', 'push_deliveries']) {
    expect((await DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first()).n).toBe(0);
  }
  await cleanupExpiredData({ DB, ALLOWED_ORIGIN: 'https://example.test' });
  expect(await DB.prepare("SELECT id FROM live_shares WHERE id='live'").first()).toEqual({ id: 'live' });
});
