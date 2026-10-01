import { afterEach, expect, test, vi } from 'vitest';
import { deliverPush, pushConfigured, validateSubscription } from './web-push';
afterEach(() => vi.unstubAllGlobals());
test('push stays disconnected; endpoints cannot target arbitrary servers', async () => {
  expect(pushConfigured({})).toBe(false);
  const s = { endpoint: 'https://fcm.googleapis.com/fcm/send/test', expirationTime: null, keys: { p256dh: 'a'.repeat(87), auth: 'a'.repeat(22) } };
  expect(validateSubscription(s).endpoint).toBe(s.endpoint);
  for (const endpoint of ['https://127.0.0.1/x', 'https://fcm.googleapis.com.evil.test/fcm/send/x', 'http://fcm.googleapis.com/fcm/send/x', 'https://fcm.googleapis.com/fcm/send/x?q=secret', 'https://u:p@fcm.googleapis.com/fcm/send/x']) expect(() => validateSubscription({ ...s, endpoint })).toThrow();
  await expect(deliverPush({}, s, { id: crypto.randomUUID(), expiresAt: Date.now() + 1000 })).rejects.toThrow('not configured');
});
test('native WebCrypto encrypts payload with VAPID and short TTL; acceptance differs from expiry/failure', async () => {
  const vapid = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign','verify']);
  const privateJwk = await crypto.subtle.exportKey('jwk', vapid.privateKey);
  const receiver = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const encoded = (v: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...(v instanceof Uint8Array ? v : new Uint8Array(v)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  const env = { VAPID_PUBLIC_KEY: encoded(await crypto.subtle.exportKey('raw', vapid.publicKey)), VAPID_PRIVATE_KEY: privateJwk.d!, VAPID_SUBJECT: 'mailto:test@example.com' };
  const s = { endpoint: 'https://fcm.googleapis.com/fcm/send/unit-test-only', expirationTime: null, keys: { p256dh: encoded(await crypto.subtle.exportKey('raw', receiver.publicKey)), auth: encoded(crypto.getRandomValues(new Uint8Array(16))) } };
  const upstream = vi.fn().mockResolvedValue(new Response(null, { status: 201 })); vi.stubGlobal('fetch', upstream);
  const data = { id: crypto.randomUUID(), expiresAt: Date.now() + 3600000 };
  expect(await deliverPush(env,s,data)).toBe('accepted');
  const init = upstream.mock.calls[0][1]; const headers = new Headers(init.headers);
  expect(headers.get('content-encoding')).toBe('aes128gcm'); expect(headers.get('authorization')).toContain('vapid'); expect(Number(headers.get('ttl'))).toBeLessThanOrEqual(60); expect(init.redirect).toBe('manual'); expect(new TextDecoder().decode(init.body)).not.toContain(data.id);
  upstream.mockResolvedValue(new Response(null, { status: 410 })); expect(await deliverPush(env,s,data)).toBe('expired');
  upstream.mockResolvedValue(new Response(null, { status: 503 })); await expect(deliverPush(env,s,data)).rejects.toThrow('not accept');
});
