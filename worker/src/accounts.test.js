import { beforeAll, afterEach, expect, test, vi } from 'vitest';
import { testDb } from './test-db';
import { accountsApi, hashToken, sessionUser } from './accounts';
import { verifyGoogle } from './google-auth';
import { validateFavorite } from '../../shared/accounts';
import worker from './index';
import { onRequest } from '../../functions/api/[[path]]';
const origin = 'https://spotland.pages.dev', clientId = '123-test.apps.googleusercontent.com', now = Date.UTC(2026, 8, 30);
const env = db => ({ DB: db, ALLOWED_ORIGIN: origin, GOOGLE_CLIENT_ID: clientId });
let pair, jwk;
beforeAll(async () => { pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1,0,1]), hash: 'SHA-256' }, true, ['sign','verify']); jwk = { ...await crypto.subtle.exportKey('jwk', pair.publicKey), kid: 'test-key' }; });
afterEach(() => vi.unstubAllGlobals());
const encode = v => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');
async function token(nonce, changes = {}, header = {}) { const h = encode({ alg: 'RS256', kid: 'test-key', ...header }); const c = encode({ iss: 'https://accounts.google.com', aud: clientId, sub: '123456789', name: 'Test Traveller', iat: now / 1000, exp: now / 1000 + 3600, nonce, ...changes }); const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(`${h}.${c}`)); return `${h}.${c}.${Buffer.from(signature).toString('base64url')}`; }
function mockKeys(maxAge = 3600) { const mock = vi.fn(async () => Response.json({ keys: [jwk] }, { headers: { 'Cache-Control': `public, max-age=${maxAge}` } })); vi.stubGlobal('fetch', mock); return mock; }
function request(path, data, cookies = '', requestOrigin = origin) { return new Request(`${origin}/api/${path}`, { method: data === undefined ? 'GET' : 'POST', headers: { Origin: requestOrigin, Cookie: cookies, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.4' }, body: data === undefined ? undefined : JSON.stringify(data) }); }
function cookie(headers, name) { return headers.getSetCookie().find(v => v.startsWith(`${name}=`)).split(';')[0]; }
async function signIn(db, sub = '123456789', oldCookie = '') { const h = new Headers(); const challenge = await accountsApi(request('auth/challenge', {}, oldCookie), env(db), h, now); const nonce = cookie(h, '__Host-spotland_nonce'); const headers = new Headers(); const result = await accountsApi(request('auth/google', { credential: await token(challenge.nonce, { sub }) }, `${nonce}; ${oldCookie}`), env(db), headers, now); return { headers, user: result.user, cookie: cookie(headers, '__Host-spotland_session'), nonce, credential: await token(challenge.nonce, { sub }) }; }
const place = { id: 'node/123', name: 'A public park', category: 'park', address: 'Public road, Delhi', hours: '24/7', lat: 28.6, lon: 77.2, sourceUrl: 'https://www.openstreetmap.org/node/123' };
test('verifies a real RSA signature and claims; rejects forgery, wrong audience/issuer/nonce, expiry, future issue time and unsafe algorithms', async () => {
  const db = testDb(); const upstream = mockKeys(); const credential = await token('nonce'); expect(await verifyGoogle(db, env(db), credential, 'nonce', now)).toEqual({ sub: '123456789', name: 'Test Traveller' });
  expect(upstream).toHaveBeenCalledWith('https://www.googleapis.com/oauth2/v3/certs', expect.objectContaining({ redirect: 'manual' }));
  for (const changes of [{ aud: 'another-client' }, { azp: 'another-client' }, { iss: 'https://evil.test' }, { nonce: 'wrong' }, { exp: now / 1000 }, { iat: now / 1000 + 61 }, { sub: '' }]) await expect(verifyGoogle(db, env(db), await token('nonce', changes), 'nonce', now)).rejects.toMatchObject({ status: 401 });
  await expect(verifyGoogle(db, env(db), await token('nonce', {}, { alg: 'none' }), 'nonce', now)).rejects.toMatchObject({ status: 401 });
  const parts = credential.split('.'); parts[1] = encode({ sub: 'forged', iss: 'https://accounts.google.com', aud: clientId, nonce: 'nonce', iat: now / 1000, exp: now / 1000 + 3600 });
  await expect(verifyGoogle(db, env(db), parts.join('.'), 'nonce', now)).rejects.toMatchObject({ status: 401 }); expect(upstream).toHaveBeenCalledTimes(1);
});
test('honors key cache expiry and rate limits unknown key refreshes; external or failed key endpoints cannot authenticate', async () => {
  const db = testDb(); const upstream = mockKeys(60); const credential = await token('nonce'); await verifyGoogle(db, env(db), credential, 'nonce', now);
  await verifyGoogle(db, env(db), credential, 'nonce', now + 1000); expect(upstream).toHaveBeenCalledTimes(1);
  await expect(verifyGoogle(db, env(db), await token('nonce', {}, { kid: 'unknown' }), 'nonce', now + 1000)).rejects.toMatchObject({ status: 429 });
  await verifyGoogle(db, env(db), credential, 'nonce', now + 60001); expect(upstream).toHaveBeenCalledTimes(2);
  await expect(verifyGoogle(testDb(), { ...env(db), GOOGLE_JWKS_URL: 'https://evil.test' }, credential, 'nonce', now)).rejects.toMatchObject({ status: 503 });
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 }))); await expect(verifyGoogle(testDb(), env(db), credential, 'nonce', now)).rejects.toMatchObject({ status: 503 });
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 302, headers: { Location: 'https://evil.test/keys' } }))); await expect(verifyGoogle(testDb(), env(db), credential, 'nonce', now)).rejects.toMatchObject({ status: 503 });
});
test('creates secure hashed sessions, consumes nonces once, rotates existing sessions and revokes them on logout', async () => {
  const db = testDb(); mockKeys(); const a = await signIn(db); expect(a.headers.getSetCookie().every(v => /Secure; HttpOnly; SameSite=Strict/.test(v) && v.includes('Path=/'))).toBe(true);
  expect(await sessionUser(request('auth/session', undefined, a.cookie), db, now)).toEqual(a.user);
  const stored = await db.prepare('SELECT * FROM sessions').first(); expect(stored.token_hash).not.toContain(a.cookie.split('=')[1]); expect(stored.token_hash).toBe(await hashToken(a.cookie.split('=')[1]));
  await expect(accountsApi(request('auth/google', { credential: a.credential }, a.nonce), env(db), new Headers(), now)).rejects.toMatchObject({ status: 401 });
  const b = await signIn(db, '123456789', a.cookie); expect(b.user.id).toBe(a.user.id); expect(await sessionUser(request('auth/session', undefined, a.cookie), db, now)).toBeNull();
  const logoutHeaders = new Headers(); await accountsApi(request('auth/logout', {}, b.cookie), env(db), logoutHeaders, now); expect(logoutHeaders.getSetCookie().every(v => v.includes('Max-Age=0'))).toBe(true); expect(await sessionUser(request('auth/session', undefined, b.cookie), db, now)).toBeNull();
});
test('requires the correct origin and nonce cookie, rejects expired cookies, and limits login attempts without exposing credentials', async () => {
  const db = testDb(); mockKeys(); await expect(accountsApi(request('auth/challenge', {}, '', 'https://evil.test'), env(db), new Headers(), now)).rejects.toMatchObject({ status: 403 });
  await expect(accountsApi(request('auth/google', { credential: await token('no-cookie') }), env(db), new Headers(), now)).rejects.toMatchObject({ status: 401 });
  const h = new Headers(); const challenge = await accountsApi(request('auth/challenge', {}), env(db), h, now); await expect(accountsApi(request('auth/google', { credential: await token(challenge.nonce) }, cookie(h, '__Host-spotland_nonce')), env(db), new Headers(), now + 300001)).rejects.toMatchObject({ status: 401 });
  const limited = testDb(); for (let i = 0; i < 10; i++) await accountsApi(request('auth/challenge', {}), env(limited), new Headers(), now);
  await expect(accountsApi(request('auth/challenge', {}), env(limited), new Headers(), now)).rejects.toMatchObject({ status: 429 });
  const signed = await signIn(db); expect(await sessionUser(request('auth/session', undefined, signed.cookie), db, now + 7 * 86400000)).toBeNull(); expect(await sessionUser(request('auth/session', undefined, `${signed.cookie}; ${signed.cookie}`), db, now)).toBeNull();
});
test('favorites are account scoped, idempotent and validated; guest writes and cross-origin deletes fail', async () => {
  const db = testDb(); mockKeys(); const a = await signIn(db, 'alice'), b = await signIn(db, 'bob'); const h = new Headers();
  await expect(accountsApi(request('favorites', { action: 'save', place }), env(db), h, now)).rejects.toMatchObject({ status: 401 });
  await accountsApi(request('favorites', { action: 'save', place, userId: b.user.id }, a.cookie), env(db), h, now); await accountsApi(request('favorites', { action: 'save', place }, a.cookie), env(db), h, now);
  expect(await accountsApi(request('favorites', undefined, a.cookie), env(db), h, now)).toEqual([{ place, savedAt: now }]); expect(await accountsApi(request('favorites', undefined, b.cookie), env(db), h, now)).toEqual([]);
  await accountsApi(request('favorites', { action: 'remove', id: place.id }, b.cookie), env(db), h, now); expect((await accountsApi(request('favorites', undefined, a.cookie), env(db), h, now)).length).toBe(1);
  await expect(accountsApi(request('favorites', { action: 'remove', id: place.id }, a.cookie, 'https://evil.test'), env(db), h, now)).rejects.toMatchObject({ status: 403 });
  for (const invalid of [null, { ...place, id: 'private:abc' }, { ...place, category: 'invalid' }, { ...place, sourceUrl: 'javascript:alert(1)' }, { ...place, lon: undefined }, { ...place, name: 'x'.repeat(121) }]) expect(() => validateFavorite(invalid)).toThrow();
  expect(validateFavorite({ ...place, id: 'seed:ihc-delhi', lat: undefined, lon: undefined, sourceUrl: undefined }).lat).toBeUndefined();
  await accountsApi(request('favorites', { action: 'remove', id: place.id }, a.cookie), env(db), h, now); expect(await accountsApi(request('favorites', undefined, a.cookie), env(db), h, now)).toEqual([]);
});
test('enforces the 200-place storage cap while allowing updates and deletion', async () => {
  const db = testDb(); mockKeys(); const a = await signIn(db); for (let i = 0; i < 200; i++) await db.prepare('INSERT INTO favorites (user_id,place_id,data,saved_at) VALUES (?,?,?,?)').bind(a.user.id, `node/${i}`, JSON.stringify({ ...place, id: `node/${i}` }), now).run();
  await expect(accountsApi(request('favorites', { action: 'save', place }, a.cookie), env(db), new Headers(), now)).resolves.toEqual({ saved: true });
  await expect(accountsApi(request('favorites', { action: 'save', place: { ...place, id: 'node/999' } }, a.cookie), env(db), new Headers(), now)).rejects.toMatchObject({ status: 409 });
  await accountsApi(request('favorites', { action: 'remove', id: 'node/0' }, a.cookie), env(db), new Headers(), now); await accountsApi(request('favorites', { action: 'save', place: { ...place, id: 'node/999' } }, a.cookie), env(db), new Headers(), now);
  expect((await accountsApi(request('favorites', undefined, a.cookie), env(db), new Headers(), now)).length).toBe(200);
});
test('auth routes are no-store, missing configuration is honest, guests remain usable, and Pages preserves cookies through its binding', async () => {
  const db = testDb(); const config = await worker.fetch(request('auth/config'), { DB: db, ALLOWED_ORIGIN: origin }); expect(await config.json()).toEqual({ clientId: '' }); expect(config.headers.get('Cache-Control')).toBe('no-store');
  const session = await worker.fetch(request('auth/session'), env(db)); expect(await session.json()).toEqual({ user: null }); expect((await worker.fetch(request('health'), env(db))).status).toBe(200);
  expect((await worker.fetch(request('auth/challenge', {}), { DB: db, ALLOWED_ORIGIN: origin })).status).toBe(503);
  const missing = await onRequest({ request: request('auth/session'), env: {} }); expect(missing.status).toBe(503);
  const fetch = vi.fn(async req => { expect(req.headers.get('Cookie')).toBe('session=opaque'); expect(req.headers.get('Origin')).toBe(origin); return new Response('ok', { headers: { 'Set-Cookie': '__Host-test=value; Path=/; Secure; HttpOnly' } }); });
  const result = await onRequest({ request: request('auth/session', undefined, 'session=opaque'), env: { API: { fetch } } }); expect(result.headers.get('Set-Cookie')).toContain('Secure; HttpOnly'); expect(fetch).toHaveBeenCalledTimes(1);
});
