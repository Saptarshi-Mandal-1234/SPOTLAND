import { expect, test } from 'vitest';
import { liveShareApi, cleanupShares } from './live-share';
import { hashToken } from './accounts';
import { testDb } from './test-db';
import worker from './index';
const origin = 'https://spotland.pages.dev', now = Date.UTC(2026, 9, 1), position = { lat: 28.6, lon: 77.2, accuracy: 15 };
const env = db => ({ DB: db, ALLOWED_ORIGIN: origin, DEVICE_SECRET: 'test-secret-which-is-more-than-forty-three-characters' });
const secret = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
function request(path, data, cookie = '', ip = '192.0.2.1', token = '') { return new Request(`${origin}/api/${path}`, { method: data ? 'POST' : 'GET', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie, 'CF-Connecting-IP': ip, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: data ? JSON.stringify(data) : undefined }); }
async function device(db, ip = '192.0.2.1', when = now) { const headers = new Headers(); await liveShareApi(request('share-device', { consent: true }, '', ip), env(db), headers, when); return headers.get('Set-Cookie').split(';')[0]; }
async function create(db, cookie, hours = 1, when = now) { const data = { action: 'create', id: crypto.randomUUID(), token: secret(), consent: true, hours, position }; const result = await liveShareApi(request('live-share', data, cookie), env(db), new Headers(), when); return { data, result, viewer: result.token }; }
test('anonymous signed devices need consent, correct origin and secret; cookie/hash are secure and tampering fails', async () => {
  const db = testDb(); const headers = new Headers(); await liveShareApi(request('share-device', { consent: true }), env(db), headers, now);
  expect(headers.get('Set-Cookie')).toContain('Secure; HttpOnly; SameSite=Strict'); const cookie = headers.get('Set-Cookie').split(';')[0];
  const stored = await db.prepare('SELECT * FROM devices').first(); expect(stored.id).toHaveLength(64); expect(stored.id).not.toContain(cookie.split('=')[1]);
  const tampered = cookie.slice(0, -4) + 'AAAA'; await expect(create(db, tampered)).rejects.toMatchObject({ status: 401 });
  await expect(create(db, `${cookie}; ${cookie}`)).rejects.toMatchObject({ status: 401 });
  await expect(liveShareApi(request('share-device', { consent: false }), env(db), new Headers(), now)).rejects.toMatchObject({ status: 400 });
  await expect(liveShareApi(request('share-device', { consent: true }), { ...env(db), DEVICE_SECRET: '' }, new Headers(), now)).rejects.toMatchObject({ status: 503 });
  const wrong = request('share-device', { consent: true }); wrong.headers.set('Origin', 'https://evil.test'); await expect(liveShareApi(wrong, env(db), new Headers(), now)).rejects.toMatchObject({ status: 403 });
});
test('1/4/8 hour shares have hashed viewer tokens, server timestamps and only a latest position', async () => {
  for (const hours of [1,4,8]) { const db = testDb(), cookie = await device(db); const { data, result, viewer } = await create(db, cookie, hours);
    expect(result).toEqual({ position, updatedAt: now, expiresAt: now + hours * 3600000, token: result.token }); expect(result.token).not.toBe(data.token);
    const row = await db.prepare('SELECT * FROM live_shares').first(); expect(row.token_hash).toBe(await hashToken(result.token)); expect(JSON.stringify(row)).not.toContain(data.token);
    const updated = await liveShareApi(request('live-share', { action: 'update', id: data.id, position: { ...position, lat: 29 } }, cookie), env(db), new Headers(), now + 30000);
    expect(updated.position.lat).toBe(29); expect((await db.prepare('SELECT COUNT(*) AS n FROM live_shares').first()).n).toBe(1);
    expect(await liveShareApi(request('live-share', null, '', '192.0.2.2', viewer), env(db), new Headers(), now + 30000)).toEqual(updated);
  }
});
test('recipient token grants read access only; another device cannot update, stop or inspect sender status', async () => {
  const db = testDb(), a = await device(db), b = await device(db, '192.0.2.2'); const { data, viewer } = await create(db, a);
  for (const body of [{ action: 'update', id: data.id, position }, { action: 'stop', id: data.id, token: data.token }, { action: 'status', id: data.id }]) {
    await expect(liveShareApi(request('live-share', body, '', '192.0.2.2', viewer), env(db), new Headers(), now + 30000)).rejects.toMatchObject({ status: 401 });
    await expect(liveShareApi(request('live-share', body, b), env(db), new Headers(), now + 30000)).rejects.toMatchObject({ status: 404 });
  }
  await expect(liveShareApi(request('live-share', null, '', '192.0.2.2', secret()), env(db), new Headers(), now)).rejects.toMatchObject({ status: 404 });
  expect((await db.prepare('SELECT COUNT(*) AS n FROM live_shares').first()).n).toBe(1);
});
test('create retries are idempotent; stop removes position and blocks delayed creates and updates', async () => {
  const db = testDb(), cookie = await device(db); const { data, result, viewer } = await create(db, cookie);
  expect(await liveShareApi(request('live-share', data, cookie), env(db), new Headers(), now + 1000)).toEqual(result);
  expect(await liveShareApi(request('live-share', { action: 'status', id: data.id, nonce: data.token }, cookie), env(db), new Headers(), now + 1000)).toEqual(result);
  expect(await liveShareApi(request('live-share', { action: 'status', id: data.id, nonce: viewer }, cookie), env(db), new Headers(), now + 1000)).toEqual(result);
  await liveShareApi(request('live-share', { action: 'stop', id: data.id, token: data.token }, cookie), env(db), new Headers(), now + 2000);
  expect((await db.prepare('SELECT COUNT(*) AS n FROM live_shares').first()).n).toBe(0);
  await expect(liveShareApi(request('live-share', null, '', '192.0.2.2', viewer), env(db), new Headers(), now + 2000)).rejects.toMatchObject({ status: 404 });
  await expect(liveShareApi(request('live-share', data, cookie), env(db), new Headers(), now + 3000)).rejects.toMatchObject({ status: 410 });
  await expect(liveShareApi(request('live-share', { action: 'update', id: data.id, position }, cookie), env(db), new Headers(), now + 30000)).rejects.toMatchObject({ status: 404 });
  const pending = { ...data, id: crypto.randomUUID(), token: secret() };
  await liveShareApi(request('live-share', { action: 'stop', id: pending.id, token: pending.token }, cookie), env(db), new Headers(), now + 30000);
  await expect(liveShareApi(request('live-share', pending, cookie), env(db), new Headers(), now + 31000)).rejects.toMatchObject({ status: 410 });
});
test('expiry rejects reads/writes and scheduled cleanup deletes precise data even without readers', async () => {
  const db = testDb(), cookie = await device(db); const { data, viewer } = await create(db, cookie);
  await cleanupShares(env(db), now + 3600000); expect((await db.prepare('SELECT COUNT(*) AS n FROM live_shares').first()).n).toBe(0);
  await expect(liveShareApi(request('live-share', null, '', '192.0.2.2', viewer), env(db), new Headers(), now + 3600000)).rejects.toMatchObject({ status: 404 });
  await expect(liveShareApi(request('live-share', data, cookie), env(db), new Headers(), now + 3600000)).rejects.toMatchObject({ status: 410 });
  const next = await create(db, cookie, 4, now + 3600001);
  await db.prepare('UPDATE live_shares SET expires_at=0 WHERE id=?').bind(next.data.id).run();
  await worker.scheduled(null, env(db)); expect((await db.prepare('SELECT COUNT(*) AS n FROM live_shares').first()).n).toBe(0);
  // The scheduled handler uses the real clock, so clean just beyond its 30-day retirement window.
  await cleanupShares(env(db), Date.now() + 30 * 86400000 + 1); expect((await db.prepare('SELECT COUNT(*) AS n FROM devices').first()).n).toBe(0); expect((await db.prepare('SELECT COUNT(*) AS n FROM retired_share_keys').first()).n).toBe(0);
});
test('rejects invalid durations/positions, enforces one active share and device update/daily limits', async () => {
  const db = testDb(), cookie = await device(db); await expect(create(db, cookie, 24)).rejects.toMatchObject({ status: 400 }); const { data } = await create(db, cookie);
  await expect(create(db, cookie)).rejects.toMatchObject({ status: 409 });
  for (const p of [{ ...position, lat: 0 }, { ...position, accuracy: -1 }, { lat: '28', lon: 77, accuracy: 1 }]) await expect(liveShareApi(request('live-share', { action: 'update', id: data.id, position: p }, cookie), env(db), new Headers(), now + 30000)).rejects.toMatchObject({ status: 400 });
  await expect(liveShareApi(request('live-share', { action: 'update', id: data.id, position }, cookie), env(db), new Headers(), now + 1000)).rejects.toMatchObject({ status: 429 });
  for (let i = 0; i < 4; i++) { try { await liveShareApi(request('live-share', { action: 'update', id: data.id, position }, cookie), env(db), new Headers(), now + 20000 + i); } catch (e) { expect(e.status).toBe(429); } }
  await expect(liveShareApi(request('live-share', { action: 'update', id: data.id, position }, cookie), env(db), new Headers(), now + 30000)).rejects.toMatchObject({ status: 429 });
  await liveShareApi(request('live-share', { action: 'stop', id: data.id, token: data.token }, cookie), env(db), new Headers(), now + 30000);
  for (let i = 0; i < 4; i++) { const next = await create(db, cookie); await liveShareApi(request('live-share', { action: 'stop', id: next.data.id, token: next.data.token }, cookie), env(db), new Headers(), now); }
  await expect(create(db, cookie)).rejects.toMatchObject({ status: 429 });
});
test('network quotas apply across anonymous devices and viewer tokens; worker responses never cache positions', async () => {
  const db = testDb(); for (let i = 0; i < 10; i++) await device(db); await expect(device(db)).rejects.toMatchObject({ status: 429 });
  const cookie = await device(db, '192.0.2.2'), { viewer } = await create(db, cookie);
  for (let i = 0; i < 60; i++) await liveShareApi(request('live-share', null, '', '192.0.2.3', viewer), env(db), new Headers(), now);
  await expect(liveShareApi(request('live-share', null, '', '192.0.2.3', viewer), env(db), new Headers(), now)).rejects.toMatchObject({ status: 429 });
  const response = await worker.fetch(request('live-share', null, '', '192.0.2.4', viewer), env(db));
  expect(response.headers.get('Cache-Control')).toBe('no-store'); expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
  expect((await worker.fetch(new Request(`${origin}/api/live-share`, { method: 'OPTIONS', headers: { Origin: 'https://evil.test' } }), env(db))).status).toBe(405);
});
test('an old recipient secret cannot be reissued after retired keys are cleaned up', async () => {
  const db = testDb(), cookie = await device(db); const original = await create(db, cookie);
  await liveShareApi(request('live-share', { action: 'stop', id: original.data.id, token: original.viewer }, cookie), env(db), new Headers(), now);
  const later = now + 31 * 86400000; await cleanupShares(env(db), later);
  const attacker = await device(db, '192.0.2.2', later);
  const replacement = await liveShareApi(request('live-share', { ...original.data, token: original.viewer }, attacker), env(db), new Headers(), later);
  expect(replacement.token).not.toBe(original.viewer);
  await expect(liveShareApi(request('live-share', null, '', '192.0.2.3', original.viewer), env(db), new Headers(), later)).rejects.toMatchObject({ status: 404 });
  expect((await liveShareApi(request('live-share', null, '', '192.0.2.3', replacement.token), env(db), new Headers(), later)).position).toEqual(position);
});
