import { bodyJson, requireDb, requireOrigin } from './events';
import { ProviderError } from './providers';
import { googleClientId, verifyGoogle, type GoogleEnv } from './google-auth';
import type { Database } from './db';
import { validateFavorite, type AccountUser } from '../../shared/accounts';
export interface AccountsEnv extends GoogleEnv { DB?: Database; ALLOWED_ORIGIN: string }
const sessionCookie = '__Host-spotland_session', nonceCookie = '__Host-spotland_nonce';
export async function hashToken(value: string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), byte => byte.toString(16).padStart(2, '0')).join(''); }
function randomToken() { return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''); }
function cookie(request: Request, name: string) {
  const values = (request.headers.get('Cookie') || '').split(';').map(v => v.trim()).filter(v => v.startsWith(`${name}=`));
  const value = values.length === 1 ? values[0].slice(name.length + 1) : '';
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : '';
}
function setCookie(headers: Headers, name: string, value: string, age: number) { headers.append('Set-Cookie', `${name}=${value}; Path=/; Max-Age=${age}; Secure; HttpOnly; SameSite=Strict`); }
async function limitLogin(db: Database, request: Request, now: number) {
  const minute = Math.floor(now / 60000);
  const key = await hashToken(`login:${minute}:${request.headers.get('CF-Connecting-IP') || 'local'}`);
  await db.prepare('DELETE FROM submission_limits WHERE expires_at <= ?').bind(now).run();
  const row = await db.prepare('INSERT INTO submission_limits (key,count,next_at,expires_at) VALUES (?,1,0,?) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count < 10 RETURNING key').bind(key, now + 120000).first();
  if (!row) throw new ProviderError('Too many sign-in attempts. Wait a minute.', 429);
}
export async function sessionUser(request: Request, db: Database, now = Date.now()): Promise<AccountUser | null> {
  const token = cookie(request, sessionCookie); if (!token) return null;
  return db.prepare('SELECT users.id,users.name FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>?').bind(await hashToken(token), now).first<AccountUser>();
}
export async function accountsApi(request: Request, env: AccountsEnv, headers: Headers, now = Date.now()) {
  const path = new URL(request.url).pathname;
  if (path === '/api/auth/config' && request.method === 'GET') return { clientId: googleClientId(env) };
  if (!['GET', 'POST'].includes(request.method)) throw new ProviderError('Method not allowed.', 405);
  if (request.method === 'POST') requireOrigin(request, env.ALLOWED_ORIGIN);
  const db = requireDb(env);
  if (path === '/api/auth/session' && request.method === 'GET') return { user: await sessionUser(request, db, now) };
  if (path === '/api/auth/challenge' && request.method === 'POST') {
    if (!googleClientId(env)) throw new ProviderError('Google sign-in is not configured yet.', 503);
    await bodyJson(request); await limitLogin(db, request, now);
    const nonce = randomToken(); await db.prepare('DELETE FROM login_challenges WHERE expires_at <= ?').bind(now).run();
    const previous = cookie(request, nonceCookie); if (previous) await db.prepare('DELETE FROM login_challenges WHERE nonce_hash=?').bind(await hashToken(previous)).run();
    await db.prepare('INSERT INTO login_challenges (nonce_hash,expires_at) VALUES (?,?)').bind(await hashToken(nonce), now + 300000).run();
    setCookie(headers, nonceCookie, nonce, 300); return { nonce };
  }
  if (path === '/api/auth/google' && request.method === 'POST') {
    const data = await bodyJson(request, 10000); await limitLogin(db, request, now);
    const nonce = cookie(request, nonceCookie); if (!nonce) throw new ProviderError('Sign-in session expired. Prepare Google sign-in again.', 401);
    const nonceHash = await hashToken(nonce);
    if (!await db.prepare('SELECT nonce_hash FROM login_challenges WHERE nonce_hash=? AND expires_at>?').bind(nonceHash, now).first()) throw new ProviderError('Sign-in session expired. Prepare Google sign-in again.', 401);
    const identity = await verifyGoogle(db, env, data?.credential, nonce, now);
    // Consume atomically after verification; a replay cannot create another session.
    if (!await db.prepare('DELETE FROM login_challenges WHERE nonce_hash=? AND expires_at>? RETURNING nonce_hash').bind(nonceHash, now).first()) throw new ProviderError('Sign-in session expired. Prepare Google sign-in again.', 401);
    setCookie(headers, nonceCookie, '', 0);
    const id = crypto.randomUUID();
    const user = await db.prepare('INSERT INTO users (id,google_sub,name,created_at) VALUES (?,?,?,?) ON CONFLICT(google_sub) DO UPDATE SET name=excluded.name RETURNING id,name').bind(id, identity.sub, identity.name, now).first<AccountUser>();
    if (!user) throw new ProviderError('Account unavailable. Try signing in again.', 503);
    const old = cookie(request, sessionCookie); if (old) await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await hashToken(old)).run();
    await db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now).run();
    const token = randomToken(); await db.prepare('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').bind(await hashToken(token), user.id, now + 7 * 86400000).run();
    setCookie(headers, sessionCookie, token, 604800); return { user };
  }
  if (path === '/api/auth/logout' && request.method === 'POST') {
    await bodyJson(request); const token = cookie(request, sessionCookie); if (token) await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await hashToken(token)).run();
    const nonce = cookie(request, nonceCookie); if (nonce) await db.prepare('DELETE FROM login_challenges WHERE nonce_hash=?').bind(await hashToken(nonce)).run();
    setCookie(headers, sessionCookie, '', 0); setCookie(headers, nonceCookie, '', 0); return { user: null };
  }
  if (path !== '/api/favorites') throw new ProviderError('Method not allowed.', 405);
  const user = await sessionUser(request, db, now); if (!user) throw new ProviderError('Sign in to save favorites.', 401);
  if (request.method === 'GET') {
    const rows = await db.prepare('SELECT data,saved_at FROM favorites WHERE user_id=? ORDER BY saved_at DESC,place_id LIMIT 200').bind(user.id).all<{ data: string; saved_at: number }>();
    return rows.results.map(row => ({ place: JSON.parse(row.data), savedAt: row.saved_at }));
  }
  const data = await bodyJson(request);
  if (data?.action === 'remove' && typeof data.id === 'string' && data.id.length <= 100) { await db.prepare('DELETE FROM favorites WHERE user_id=? AND place_id=?').bind(user.id, data.id).run(); return { saved: false }; }
  if (data?.action !== 'save') throw new ProviderError('Invalid favorite action.', 400);
  let place; try { place = validateFavorite(data.place); } catch (error) { throw new ProviderError((error as Error).message, 400); }
  const row = await db.prepare('INSERT INTO favorites (user_id,place_id,data,saved_at) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM favorites WHERE user_id=?) < 200 OR EXISTS (SELECT 1 FROM favorites WHERE user_id=? AND place_id=?) ON CONFLICT(user_id,place_id) DO UPDATE SET data=excluded.data,saved_at=excluded.saved_at RETURNING place_id').bind(user.id, place.id, JSON.stringify(place), now, user.id, user.id, place.id).first();
  if (!row) throw new ProviderError('Your 200 favorite slots are full. Remove one first.', 409);
  return { saved: true };
}
