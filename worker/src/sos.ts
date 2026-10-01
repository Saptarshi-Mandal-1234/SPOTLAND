import { bodyJson, requireDb, requireOrigin } from './events';
import { device, type LiveShareEnv } from './live-share';
import { hashToken } from './accounts';
import { reserveProvider, type Database } from './db';
import { ProviderError } from './providers';
import { approximateDirection, approximateDistance, decodeArea, nearbyHashes, nearbyLifetime, reportThreshold, sosLifetime, sosRadiusKm, type NearbyAlert, type SosReceipt } from '../../shared/sos';
import { deliverPush, pushConfigured, validateSubscription, type PushEnv } from './web-push';
export interface SosEnv extends LiveShareEnv, PushEnv { SOS_ENABLED?: string; PUSH_ENABLED?: string }
interface AlertRow { id: string; device_id: string; geohash: string; status: 'active' | 'safe' | 'hidden'; created_at: number; expires_at: number; report_count: number }
interface NearbyDevice { id: string; geohash: string; nearby_expires_at: number; push_sub: string | null }
const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id);
async function limit(db: Database, scope: string, identity: string, max: number, period: number, now: number) {
  const key = await hashToken(`sos:${scope}:${Math.floor(now / period)}:${identity}`);
  if (!await db.prepare('INSERT INTO submission_limits (key,count,next_at,expires_at) VALUES (?,1,0,?) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count < ? RETURNING key').bind(key, now + 2 * period, max).first()) throw new ProviderError('Safety request limit reached. Wait before retrying; Call 112 for urgent help.', 429);
}
export async function cleanupSos(env: { DB?: Database }, now = Date.now()) {
  const db = requireDb(env);
  await db.prepare('INSERT OR IGNORE INTO retired_sos_ids (id,expires_at) SELECT id,? FROM sos_alerts WHERE expires_at<=?').bind(now + 30 * 86400000, now).run();
  await db.prepare('DELETE FROM sos_alerts WHERE expires_at<=?').bind(now).run();
  await db.prepare('UPDATE devices SET geohash=NULL,nearby_expires_at=0,push_sub=NULL WHERE nearby_expires_at>0 AND nearby_expires_at<=?').bind(now).run();
  await db.prepare('DELETE FROM retired_sos_ids WHERE expires_at<=?').bind(now).run();
}
async function nearbyDevices(db: Database, hash: string, now: number) {
  const hashes = nearbyHashes(hash);
  const rows = (await db.prepare(`SELECT id,geohash,nearby_expires_at,push_sub FROM devices WHERE geohash IN (${hashes.map(() => '?').join(',')}) AND nearby_expires_at>? AND expires_at>? LIMIT 201`).bind(...hashes, now, now).all<NearbyDevice>()).results;
  if (rows.length > 200) throw new ProviderError('Nearby safety capacity is unavailable on this free pilot. Alert NOT sent; use contacts and Call 112.', 503);
  return rows.filter(row => approximateDistance(row.geohash, hash) <= sosRadiusKm);
}
async function receipt(db: Database, row: AlertRow): Promise<SosReceipt> {
  const counts = (await db.prepare('SELECT status,COUNT(*) AS n FROM push_deliveries WHERE alert_id=? GROUP BY status').bind(row.id).all<{ status: string; n: number }>()).results;
  const count = (names: string[]) => counts.filter(c => names.includes(c.status)).reduce((n,c) => n + c.n, 0);
  return { id: row.id, status: row.status, expiresAt: row.expires_at, push: { sent: count(['sent']), pending: count(['pending','sending']), failed: count(['failed']), eligible: count(['pending','sending','sent','failed']) } };
}
export async function dispatchSosPush(env: SosEnv, alertId?: string, now = Date.now()) {
  if (!pushConfigured(env)) return;
  const startedAt = Date.now();
  const db = requireDb(env);
  const clause = alertId ? ' AND p.alert_id=?' : '';
  // Claim the complete bounded pilot in one query; six senders share the work.
  const jobs = (await db.prepare(`UPDATE push_deliveries SET status='sending',attempts=attempts+1,next_at=? WHERE (alert_id,device_id) IN (SELECT p.alert_id,p.device_id FROM push_deliveries p JOIN sos_alerts a ON a.id=p.alert_id WHERE a.status='active' AND a.expires_at>? AND p.status IN ('pending','sending') AND p.next_at<=? AND p.attempts<3${clause} ORDER BY p.next_at LIMIT 36) RETURNING alert_id,device_id,attempts`).bind(now + 30000, now, now, ...(alertId ? [alertId] : [])).all<{alert_id: string; device_id: string; attempts: number}>()).results;
  const outcomes: { alert_id: string; device_id: string; status: string; expired: boolean; subscription: string }[] = [];
  for (let offset = 0; offset < jobs.length; offset += 6) {
    const batch = jobs.slice(offset, offset + 6);
    const checkAt = now + Math.max(0, Date.now() - startedAt);
    const targets = (await db.prepare("SELECT d.id,a.id AS alert_id,d.geohash,d.push_sub,d.nearby_expires_at,a.geohash AS alert_geohash,a.expires_at FROM json_each(?) j JOIN devices d ON d.id=json_extract(j.value,'$.device_id') JOIN sos_alerts a ON a.id=json_extract(j.value,'$.alert_id') WHERE d.nearby_expires_at>? AND d.expires_at>? AND a.status='active' AND a.expires_at>?").bind(JSON.stringify(batch), checkAt, checkAt, checkAt).all<{id: string; alert_id: string; geohash: string; push_sub: string | null; nearby_expires_at: number; alert_geohash: string; expires_at: number}>()).results;
    await Promise.all(batch.map(async job => {
      const target = targets.find(target => target.id === job.device_id && target.alert_id === job.alert_id);
      let status = 'failed', expired = false;
      if (target?.push_sub && target.geohash && approximateDistance(target.geohash, target.alert_geohash) <= sosRadiusKm) {
        try { const result = await deliverPush(env, JSON.parse(target.push_sub), { id: job.alert_id, expiresAt: Math.min(target.expires_at, target.nearby_expires_at) }, checkAt); status = result === 'accepted' ? 'sent' : 'failed'; expired = result === 'expired'; }
        catch { status = job.attempts >= 3 ? 'failed' : 'pending'; }
      }
      outcomes.push({ ...job, status, expired, subscription: target?.push_sub || '' });
    }));
  }
  if (outcomes.length) {
    const json = JSON.stringify(outcomes);
    // A closed/hidden job stays failed; an expired old subscription cannot clear its replacement.
    await db.prepare("UPDATE push_deliveries SET status=(SELECT json_extract(value,'$.status') FROM json_each(?) WHERE json_extract(value,'$.alert_id')=alert_id AND json_extract(value,'$.device_id')=device_id),next_at=? WHERE status='sending' AND next_at=? AND (alert_id,device_id) IN (SELECT json_extract(value,'$.alert_id'),json_extract(value,'$.device_id') FROM json_each(?))").bind(json, now + 30000, now + 30000, json).run();
    await db.prepare("UPDATE devices SET push_sub=NULL WHERE EXISTS (SELECT 1 FROM json_each(?) WHERE json_extract(value,'$.expired')=1 AND json_extract(value,'$.device_id')=devices.id AND json_extract(value,'$.subscription')=devices.push_sub)").bind(json).run();
  }
  await db.prepare("UPDATE push_deliveries SET status='failed' WHERE status='sending' AND attempts>=3 AND next_at<=?").bind(now).run();
}
export async function sosApi(request: Request, env: SosEnv, now = Date.now()) {
  const path = new URL(request.url).pathname;
  const receivingEnabled = !!env.DB && !!env.DEVICE_SECRET && (env.SOS_ENABLED === 'true' || (env.PUSH_ENABLED === 'true' && pushConfigured(env)));
  if (path === '/api/sos-config' && request.method === 'GET') return { receivingEnabled, enabled: env.SOS_ENABLED === 'true' && !!env.DB && !!env.DEVICE_SECRET, pushPublicKey: pushConfigured(env) ? env.VAPID_PUBLIC_KEY : null, radiusKm: sosRadiusKm };
  if (path === '/api/sos' ? env.SOS_ENABLED !== 'true' : !receivingEnabled) throw new ProviderError('SOS broadcast is not configured. Call 112 and use your contacts.', 503);
  if (request.method !== 'POST') throw new ProviderError('Method not allowed.', 405);
  requireOrigin(request, env.ALLOWED_ORIGIN);
  const db = requireDb(env), owner = await device(request, env, now), ip = request.headers.get('CF-Connecting-IP') || 'local';
  const data = await bodyJson(request, 5000); if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ProviderError('Invalid safety request.', 400);
  await limit(db, 'requests-device', owner, 20, 60000, now); await limit(db, 'requests-ip', ip, 120, 60000, now);
  await cleanupSos(env, now);
  if (path === '/api/nearby-alerts') {
    if (data.action === 'off') { await db.prepare('UPDATE devices SET geohash=NULL,nearby_expires_at=0,push_sub=NULL WHERE id=?').bind(owner).run(); return { expiresAt: 0, alerts: [] }; }
    if (data.action === 'optin') {
      if (data.consent !== true) throw new ProviderError('Nearby alerts require explicit consent.', 400);
      try { decodeArea(data.geohash); } catch (error) { throw new ProviderError((error as Error).message, 400); }
      const expired = now + nearbyLifetime;
      await db.prepare('UPDATE devices SET geohash=?,nearby_expires_at=? WHERE id=?').bind(data.geohash, expired, owner).run();
    } else if (data.action === 'unsubscribe') {
      await db.prepare('UPDATE devices SET push_sub=NULL WHERE id=?').bind(owner).run();
    } else if (data.action === 'subscribe') {
      if (data.consent !== true || !pushConfigured(env)) throw new ProviderError('Push consent and operator configuration are required.', 400);
      let subscription; try { subscription = validateSubscription(data.subscription); } catch (error) { throw new ProviderError((error as Error).message, 400); }
      if (!await db.prepare('UPDATE devices SET push_sub=? WHERE id=? AND nearby_expires_at>? RETURNING id').bind(JSON.stringify(subscription), owner, now).first()) throw new ProviderError('Opt in to nearby alerts first.', 403);
    } else if (data.action === 'test') {
      if (data.consent !== true || !pushConfigured(env)) throw new ProviderError('Explicit test consent and push configuration are required.', 400);
      const target = await db.prepare('SELECT push_sub FROM devices WHERE id=? AND nearby_expires_at>?').bind(owner, now).first<{push_sub: string | null}>();
      if (!target?.push_sub) throw new ProviderError('Enable nearby alerts and push on this device first.', 403);
      await limit(db, 'test-device', owner, 3, 86400000, now); await limit(db, 'test-ip', ip, 15, 86400000, now);
      const result = await deliverPush(env, JSON.parse(target.push_sub), { id: crypto.randomUUID(), expiresAt: now + 60000, type: 'spotland-push-test' }, now);
      if (result === 'expired') { await db.prepare('UPDATE devices SET push_sub=NULL WHERE id=? AND push_sub=?').bind(owner, target.push_sub).run(); throw new ProviderError('Subscription expired. Enable push again.', 410); }
      return { accepted: true, message: 'Push service accepted the test. Check this device for the notification; acceptance alone does not confirm display.' };
    } else if (!['list','status'].includes(data.action)) throw new ProviderError('Invalid nearby action.', 400);
    const me = await db.prepare('SELECT id,geohash,nearby_expires_at,push_sub FROM devices WHERE id=?').bind(owner).first<NearbyDevice>();
    if (!me?.geohash || me.nearby_expires_at <= now) return { expiresAt: 0, pushEnabled: false, alerts: [] };
    const hashes = nearbyHashes(me.geohash);
    const rows = (await db.prepare(`SELECT * FROM sos_alerts WHERE geohash IN (${hashes.map(() => '?').join(',')}) AND status='active' AND expires_at>? AND device_id!=? ORDER BY created_at DESC LIMIT 101`).bind(...hashes, now, owner).all<AlertRow>()).results;
    if (rows.length > 100) throw new ProviderError('Nearby alert list exceeds free pilot capacity. Call 112 for urgent help.', 503);
    const alerts: NearbyAlert[] = rows.filter(row => approximateDistance(me.geohash, row.geohash) <= sosRadiusKm).map(row => ({ id: row.id, geohash: row.geohash, createdAt: row.created_at, expiresAt: row.expires_at, distanceKm: Math.round(approximateDistance(me.geohash!, row.geohash) * 10) / 10, direction: approximateDirection(me.geohash!, row.geohash) }));
    return { expiresAt: me.nearby_expires_at, pushEnabled: !!me.push_sub, alerts };
  }
  if (!validId(data.id)) throw new ProviderError('Invalid alert identifier.', 400);
  if (data.action === 'close') {
    const other = await db.prepare('SELECT id FROM sos_alerts WHERE id=? AND device_id!=?').bind(data.id,owner).first(); if (other) throw new ProviderError('Alert not found on this device.', 404);
    await db.prepare('INSERT OR IGNORE INTO retired_sos_ids (id,expires_at) VALUES (?,?)').bind(data.id, now + 30 * 86400000).run();
    await db.prepare("UPDATE sos_alerts SET status='safe',geohash='' WHERE id=? AND device_id=?").bind(data.id,owner).run();
    await db.prepare("UPDATE push_deliveries SET status='failed' WHERE alert_id=? AND status IN ('pending','sending')").bind(data.id).run();
    return { closed: true };
  }
  if (data.action === 'create' || data.action === 'status') {
    const existing = await db.prepare('SELECT * FROM sos_alerts WHERE id=? AND device_id=?').bind(data.id,owner).first<AlertRow>();
    if (existing) return receipt(db,existing);
    if (data.action === 'status') throw new ProviderError('Alert not found or expired.', 404);
    if (data.consent !== true || data.radius !== undefined) throw new ProviderError('Consent required. The server fixes the radius at 2 km.', 400);
    try { decodeArea(data.geohash); } catch (error) { throw new ProviderError((error as Error).message, 400); }
    if (!Number.isFinite(data.startedAt) || data.startedAt > now + 60000 || data.startedAt < now - 900000) throw new ProviderError('Queued SOS is too old. Start a new SOS if still needed.', 400);
    if (!validId(data.shareId) || !await db.prepare('SELECT id FROM live_shares WHERE id=? AND device_id=? AND expires_at>?').bind(data.shareId,owner,now).first()) throw new ProviderError('Confirm the private contact live share before nearby broadcast.', 400);
    if (await db.prepare('SELECT id FROM retired_sos_ids WHERE id=?').bind(data.id).first()) throw new ProviderError('This SOS has ended. Start a new one if needed.', 410);
    const targets = (await nearbyDevices(db, data.geohash, now)).filter(t => t.id !== owner && t.push_sub);
    if (targets.length > 36) throw new ProviderError('Real-time push capacity exceeded on the free pilot. Nearby alert NOT sent; use contacts and Call 112.', 503);
    await limit(db, 'create-device', owner, 3, 86400000, now); await limit(db, 'create-ip', ip, 15, 86400000, now);
    if (!await reserveProvider(db, 'sos-cooldown:' + owner, 5 * 60000, now)) throw new ProviderError('SOS cooldown is active. Call 112 and use the existing share.', 429);
    if (!db.batch) throw new ProviderError('Safety storage transactions unavailable. Alert NOT saved.', 503);
    try {
      await db.batch([
        db.prepare("INSERT OR IGNORE INTO sos_alerts (id,device_id,geohash,status,created_at,expires_at) SELECT ?,?,?,'active',?,? WHERE NOT EXISTS (SELECT 1 FROM retired_sos_ids WHERE id=?)").bind(data.id,owner,data.geohash,now,now + sosLifetime,data.id),
        db.prepare("INSERT OR IGNORE INTO push_deliveries (alert_id,device_id,status,next_at) SELECT ?,json_extract(value,'$.id'),'pending',? FROM json_each(?) WHERE EXISTS (SELECT 1 FROM sos_alerts WHERE id=? AND device_id=? AND status='active')").bind(data.id,now,JSON.stringify(targets.map(target => ({id:target.id}))),data.id,owner),
      ]);
    } catch {
      await db.prepare('DELETE FROM provider_gates WHERE name=? AND next_at=?').bind('sos-cooldown:' + owner,now + 5 * 60000).run();
      throw new ProviderError('Safety storage failed. Alert NOT saved; retry or Call 112.', 503);
    }
    const inserted = await db.prepare('SELECT * FROM sos_alerts WHERE id=? AND device_id=?').bind(data.id,owner).first<AlertRow>();
    if (!inserted) throw new ProviderError('This SOS has ended or its identifier is already used.', 409);
    return receipt(db,inserted);
  }
  if (!['report','help'].includes(data.action)) throw new ProviderError('Invalid SOS action.', 400);
  const me = await db.prepare('SELECT id,geohash,nearby_expires_at,push_sub FROM devices WHERE id=? AND nearby_expires_at>?').bind(owner,now).first<NearbyDevice>();
  const row = await db.prepare("SELECT * FROM sos_alerts WHERE id=? AND status='active' AND expires_at>? AND device_id!=?").bind(data.id,now,owner).first<AlertRow>();
  if (!me?.geohash || !row || approximateDistance(me.geohash,row.geohash) > sosRadiusKm) throw new ProviderError('Alert not available in your approximate area.', 404);
  if (data.action === 'help') { await db.prepare('INSERT OR IGNORE INTO sos_help (alert_id,device_id) VALUES (?,?)').bind(row.id,owner).run(); return { recorded: true, message: 'Response recorded, not a guarantee of assistance. Call 112; do not put yourself at risk.' }; }
  await limit(db, 'reports-device', owner, 6, 86400000, now); await limit(db, 'reports-ip', ip, 20, 86400000, now);
  await db.prepare('INSERT OR IGNORE INTO sos_reports (alert_id,device_id) VALUES (?,?)').bind(row.id,owner).run();
  await db.prepare("UPDATE sos_alerts SET report_count=(SELECT COUNT(*) FROM sos_reports WHERE alert_id=?), status=CASE WHEN (SELECT COUNT(*) FROM sos_reports WHERE alert_id=?)>=? THEN 'hidden' ELSE status END WHERE id=?").bind(row.id,row.id,reportThreshold,row.id).run();
  return { reported: true };
}
