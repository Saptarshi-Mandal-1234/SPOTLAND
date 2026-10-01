import { bodyJson, requireDb, requireOrigin } from './events';
import { hashToken } from './accounts';
import { ProviderError } from './providers';
import type { Database } from './db';
import { shareHours, validateSharePosition, type ShareSnapshot } from '../../shared/live-share';
export interface LiveShareEnv { DB?: Database; ALLOWED_ORIGIN: string; DEVICE_SECRET?: string }
const cookieName = '__Host-spotland_device', deviceAge = 30 * 86400000;
const validToken = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{43}$/.test(v);
const validId = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const encode = (v: Uint8Array) => btoa(String.fromCharCode(...v)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
async function signingKey(env: LiveShareEnv) {
  if (!env.DEVICE_SECRET || env.DEVICE_SECRET.length < 43) throw new ProviderError('Location sharing is not configured yet.', 503);
  return crypto.subtle.importKey('raw', new TextEncoder().encode(env.DEVICE_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function viewerToken(env: LiveShareEnv, id: string, owner: string, expiry: number, nonce: string) {
  return encode(new Uint8Array(await crypto.subtle.sign('HMAC', await signingKey(env), new TextEncoder().encode(`share-view:v1:${id}:${owner}:${expiry}:${nonce}`))));
}
export async function device(request: Request, env: LiveShareEnv, now: number) {
  const matches = (request.headers.get('Cookie') || '').split(';').map(v => v.trim()).filter(v => v.startsWith(`${cookieName}=`));
  if (matches.length !== 1) throw new ProviderError('Prepare sharing on this browser first.', 401);
  const parts = matches[0].slice(cookieName.length + 1).split('.');
  if (parts.length !== 3 || !validToken(parts[0]) || !/^\d{13}$/.test(parts[1]) || Number(parts[1]) <= now || Number(parts[1]) > now + deviceAge || !validToken(parts[2])) throw new ProviderError('Sharing device session expired. Prepare again.', 401);
  const signature = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  if (!await crypto.subtle.verify('HMAC', await signingKey(env), signature, new TextEncoder().encode(`${parts[0]}.${parts[1]}`))) throw new ProviderError('Invalid sharing device session.', 401);
  const id = await hashToken(parts[0]);
  if (!await requireDb(env).prepare('SELECT id FROM devices WHERE id=? AND expires_at>?').bind(id, now).first()) throw new ProviderError('Sharing device session expired. Prepare again.', 401);
  return id;
}
async function limit(db: Database, name: string, identity: string, max: number, period: number, now: number) {
  const key = await hashToken(`share:${name}:${Math.floor(now / period)}:${identity}`);
  const row = await db.prepare('INSERT INTO submission_limits (key,count,next_at,expires_at) VALUES (?,1,0,?) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count < ? RETURNING key').bind(key, now + period * 2, max).first();
  if (!row) throw new ProviderError('Sharing limit reached. Wait before retrying.', 429);
}
export async function cleanupShares(env: { DB?: Database }, now = Date.now()) {
  const db = requireDb(env);
  await db.prepare('INSERT OR IGNORE INTO retired_share_keys (id,token_hash,expires_at) SELECT id,token_hash,? FROM live_shares WHERE expires_at<=?').bind(now + deviceAge, now).run();
  await db.prepare('DELETE FROM live_shares WHERE expires_at<=?').bind(now).run();
  await db.prepare('DELETE FROM devices WHERE expires_at<=?').bind(now).run();
  await db.prepare('DELETE FROM submission_limits WHERE expires_at<=?').bind(now).run();
  await db.prepare('DELETE FROM retired_share_keys WHERE expires_at<=?').bind(now).run();
}
interface Row { id: string; token_hash: string; lat: number; lon: number; accuracy: number; updated_at: number; expires_at: number }
function snapshot(row: Row): ShareSnapshot { return { position: { lat: row.lat, lon: row.lon, accuracy: row.accuracy }, updatedAt: row.updated_at, expiresAt: row.expires_at }; }
export async function liveShareApi(request: Request, env: LiveShareEnv, headers: Headers, now = Date.now()) {
  const path = new URL(request.url).pathname;
  if (!['GET', 'POST'].includes(request.method)) throw new ProviderError('Method not allowed.', 405);
  if (request.method === 'POST') requireOrigin(request, env.ALLOWED_ORIGIN);
  const db = requireDb(env), ip = request.headers.get('CF-Connecting-IP') || 'local';
  await cleanupShares(env, now);
  if (path === '/api/live-share' && request.method === 'GET') {
    const token = request.headers.get('Authorization')?.replace(/^Bearer /, '');
    if (!validToken(token)) throw new ProviderError('Sharing link is invalid or expired.', 404);
    await limit(db, 'read-ip', ip, 60, 60000, now);
    const row = await db.prepare('SELECT * FROM live_shares WHERE token_hash=? AND expires_at>?').bind(await hashToken(token), now).first<Row>();
    if (!row) throw new ProviderError('Sharing has stopped or this link has expired.', 404);
    return snapshot(row);
  }
  if (request.method !== 'POST') throw new ProviderError('Method not allowed.', 405);
  const data = await bodyJson(request);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ProviderError('Invalid sharing request.', 400);
  if (path === '/api/share-device') {
    if (data.consent !== true) throw new ProviderError('Consent is required before sharing.', 400);
    const key = await signingKey(env);
    try { await device(request, env, now); return { ready: true }; } catch (error) { if (!(error instanceof ProviderError) || error.status !== 401) throw error; }
    await limit(db, 'device-ip', ip, 10, 3600000, now);
    const random = encode(crypto.getRandomValues(new Uint8Array(32))), expiry = now + deviceAge;
    const payload = `${random}.${expiry}`, signature = encode(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))));
    await db.prepare('INSERT INTO devices (id,expires_at) VALUES (?,?)').bind(await hashToken(random), expiry).run();
    headers.append('Set-Cookie', `${cookieName}=${payload}.${signature}; Path=/; Max-Age=${deviceAge / 1000}; Secure; HttpOnly; SameSite=Strict`);
    return { ready: true };
  }
  const owner = await device(request, env, now);
  if (!validId(data.id)) throw new ProviderError('Invalid sharing identifier.', 400);
  if (data.action === 'stop') {
    if (!validToken(data.token)) throw new ProviderError('Invalid sharing token.', 400);
    await limit(db, 'stop-ip', ip, 30, 60000, now);
    const other = await db.prepare('SELECT id FROM live_shares WHERE id=? AND device_id!=?').bind(data.id, owner).first();
    if (other) throw new ProviderError('Sharing not found on this device.', 404);
    const stopped = await db.prepare('SELECT token_hash FROM live_shares WHERE id=? AND device_id=?').bind(data.id, owner).first<{ token_hash: string }>();
    // Retire even an uncertain create so a delayed request cannot revive a stopped link.
    await db.prepare('INSERT OR IGNORE INTO retired_share_keys (id,token_hash,expires_at) VALUES (?,?,?)').bind(data.id, stopped?.token_hash || await hashToken(data.token), now + deviceAge).run();
    await db.prepare('DELETE FROM live_shares WHERE id=? AND device_id=?').bind(data.id, owner).run();
    return { stopped: true };
  }
  if (data.action === 'status') {
    await limit(db, 'status-ip', ip, 60, 60000, now);
    const row = await db.prepare('SELECT * FROM live_shares WHERE id=? AND device_id=? AND expires_at>?').bind(data.id, owner, now).first<Row>();
    if (!row) throw new ProviderError('Sharing has stopped or expired.', 404);
    if (!validToken(data.nonce)) throw new ProviderError('Invalid sharing recovery token.', 400);
    const recovered = await hashToken(data.nonce) === row.token_hash ? data.nonce : await viewerToken(env, row.id, owner, row.expires_at, data.nonce);
    if (await hashToken(recovered) !== row.token_hash) throw new ProviderError('Sharing recovery token does not match.', 400);
    return { ...snapshot(row), token: recovered };
  }
  let position; try { position = validateSharePosition(data.position); } catch (error) { throw new ProviderError((error as Error).message, 400); }
  if (data.action === 'create') {
    if (data.consent !== true || !shareHours.includes(data.hours) || !validToken(data.token)) throw new ProviderError('Choose consent and a 1, 4 or 8 hour expiry.', 400);
    if (await db.prepare('SELECT id FROM retired_share_keys WHERE id=? OR token_hash=?').bind(data.id, await hashToken(data.token)).first()) throw new ProviderError('This sharing link has ended. Start a new share.', 410);
    const existing = await db.prepare('SELECT * FROM live_shares WHERE id=? AND device_id=?').bind(data.id, owner).first<Row>();
    const expiry = existing?.expires_at || now + data.hours * 3600000;
    // Bind the recipient secret to the sender and server expiry; input is only a nonce.
    const token = await viewerToken(env, data.id, owner, expiry, data.token), tokenHash = await hashToken(token);
    if (existing) { if (existing.token_hash !== tokenHash) throw new ProviderError('Sharing identifier already used.', 409); return { ...snapshot(existing), token }; }
    await limit(db, 'create-ip', ip, 30, 86400000, now); await limit(db, 'create-device', owner, 6, 86400000, now);
    const inserted = await db.prepare('INSERT OR IGNORE INTO live_shares (id,token_hash,device_id,lat,lon,accuracy,updated_at,expires_at) SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM live_shares WHERE device_id=?) AND NOT EXISTS (SELECT 1 FROM retired_share_keys WHERE id=? OR token_hash=?) RETURNING id').bind(data.id, tokenHash, owner, position.lat, position.lon, position.accuracy, now, now + data.hours * 3600000, owner, data.id, tokenHash).first();
    if (!inserted) throw new ProviderError('A share is already active on this device. Stop it first.', 409);
    return { position, updatedAt: now, expiresAt: expiry, token };
  }
  if (data.action !== 'update') throw new ProviderError('Invalid sharing action.', 400);
  await limit(db, 'update-ip', ip, 120, 60000, now); await limit(db, 'update-device', owner, 4, 60000, now);
  const row = await db.prepare('UPDATE live_shares SET lat=?,lon=?,accuracy=?,updated_at=? WHERE id=? AND device_id=? AND expires_at>? AND updated_at<=? RETURNING *').bind(position.lat, position.lon, position.accuracy, now, data.id, owner, now, now - 15000).first<Row>();
  if (!row) {
    if (await db.prepare('SELECT id FROM live_shares WHERE id=? AND device_id=? AND expires_at>?').bind(data.id, owner, now).first()) throw new ProviderError('Wait 15 seconds before another update.', 429);
    throw new ProviderError('Sharing has stopped or expired.', 404);
  }
  return snapshot(row);
}
