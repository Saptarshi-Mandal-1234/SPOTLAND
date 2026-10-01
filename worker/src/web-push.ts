import { buildPushPayload, type PushSubscription } from '@block65/webcrypto-web-push';
export interface PushEnv { VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_KEY?: string; VAPID_SUBJECT?: string }
export function pushConfigured(env: PushEnv) { return /^[A-Za-z0-9_-]{87}$/.test(env.VAPID_PUBLIC_KEY || '') && /^[A-Za-z0-9_-]{43}$/.test(env.VAPID_PRIVATE_KEY || '') && /^(mailto:[^\s@]+@[^\s@]+|https:\/\/[^\s]+)$/.test(env.VAPID_SUBJECT || ''); }
export function validateSubscription(value: unknown): PushSubscription {
  const s = value as PushSubscription | null; if (!s || typeof s.endpoint !== 'string' || s.endpoint.length > 1800 || !s.keys || !/^[A-Za-z0-9_-]{87}$/.test(s.keys.p256dh) || !/^[A-Za-z0-9_-]{22}$/.test(s.keys.auth)) throw new Error('Invalid push subscription.');
  const url = new URL(s.endpoint);
  const allowed = url.hostname === 'fcm.googleapis.com' && /^\/(fcm\/send|wp)\//.test(url.pathname) || url.hostname.endsWith('.push.apple.com') && url.pathname.length > 1 || url.hostname === 'updates.push.services.mozilla.com' && url.pathname.startsWith('/wpush/');
  if (!allowed || url.protocol !== 'https:' || url.port || url.username || url.password || url.hash || url.search) throw new Error('Unsupported push service.');
  if (s.expirationTime !== null && (!Number.isFinite(s.expirationTime) || s.expirationTime <= Date.now())) throw new Error('Push subscription expired.');
  return { endpoint: url.href, expirationTime: s.expirationTime, keys: { auth: s.keys.auth, p256dh: s.keys.p256dh } };
}
export async function deliverPush(env: PushEnv, subscription: PushSubscription, data: { id: string; expiresAt: number; type?: 'spotland-push-test' }, now = Date.now()) {
  if (!pushConfigured(env)) throw new Error('Push is not configured.');
  const safe = validateSubscription(subscription);
  // Lock-screen content omits names, precise positions and private live-share links.
  const payload = await buildPushPayload({ data: JSON.stringify({ type: data.type || 'spotland-sos', id: data.id, expiresAt: data.expiresAt }), options: { ttl: Math.max(0, Math.min(60, Math.floor((data.expiresAt - now) / 1000))), urgency: 'high', topic: data.id.replace(/-/g, '').slice(0,32) } }, safe, { publicKey: env.VAPID_PUBLIC_KEY!, privateKey: env.VAPID_PRIVATE_KEY!, subject: env.VAPID_SUBJECT! });
  const response = await fetch(safe.endpoint, { ...payload, redirect: 'manual', signal: AbortSignal.timeout(3000) });
  await response.body?.cancel().catch(() => {});
  if (response.status === 404 || response.status === 410) return 'expired';
  if (response.status !== 201 && response.status !== 202) throw new Error('Push service did not accept the notification.');
  return 'accepted';
}
