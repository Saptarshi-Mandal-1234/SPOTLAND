import { afterEach, expect, test, vi } from 'vitest';
import { disableSosPush, enableSosPush, sosPushRegistration } from './sos-push';
afterEach(() => vi.unstubAllGlobals());
const key = 'B' + 'a'.repeat(86);
function fixture(permission: NotificationPermission = 'granted', existing = false) {
  const requestPermission = vi.fn().mockResolvedValue(permission);
  vi.stubGlobal('Notification', { requestPermission });
  const subscription = { toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/test', keys: {} }), unsubscribe: vi.fn().mockResolvedValue(true), options: {} };
  const registration = { active: {}, pushManager: { getSubscription: vi.fn().mockResolvedValue(existing ? subscription : null), subscribe: vi.fn().mockResolvedValue(subscription) } };
  const fetch = vi.fn().mockResolvedValue(Response.json({expiresAt:Date.now()+60000,pushEnabled:true,alerts:[]})); vi.stubGlobal('fetch',fetch);
  return { requestPermission, subscription, registration: registration as unknown as ServiceWorkerRegistration, fetch };
}
test('permission is requested synchronously only on enable; explicit consent registration succeeds', async () => {
  const f = fixture(); const pending = enableSosPush(f.registration,key); expect(f.requestPermission).toHaveBeenCalledTimes(1); await pending;
  expect(f.registration.pushManager.subscribe).toHaveBeenCalledWith({userVisibleOnly:true,applicationServerKey:expect.any(ArrayBuffer)});
  expect(JSON.parse(f.fetch.mock.calls[0][1].body)).toEqual({action:'subscribe',consent:true,subscription:f.subscription.toJSON()});
});
test('denial sends no subscription; failed server registration removes only a newly created subscription', async () => {
  const denied = fixture('denied'); await expect(enableSosPush(denied.registration,key)).rejects.toThrow('not allowed'); expect(denied.fetch).not.toHaveBeenCalled();
  for (const existing of [false,true]) { const f=fixture('granted',existing); f.fetch.mockResolvedValue(Response.json({error:'Offline'},{status:503})); await expect(enableSosPush(f.registration,key)).rejects.toThrow('Offline'); expect(f.subscription.unsubscribe).toHaveBeenCalledTimes(existing?0:1); }
});
test('notification-only opt-out clears server first; failure does not falsely report removal', async () => {
  const f=fixture('granted',true); await disableSosPush(f.registration); expect(JSON.parse(f.fetch.mock.calls[0][1].body)).toEqual({action:'unsubscribe'}); expect(f.subscription.unsubscribe).toHaveBeenCalledTimes(1); expect(f.requestPermission).not.toHaveBeenCalled();
  f.subscription.unsubscribe.mockClear(); f.fetch.mockResolvedValue(Response.json({error:'Offline'},{status:503})); await expect(disableSosPush(f.registration)).rejects.toThrow('Offline'); expect(f.subscription.unsubscribe).not.toHaveBeenCalled();
});
test('registration inspection never requests permission; missing production worker fails visibly',async()=>{
  const f=fixture(); vi.stubGlobal('window',{isSecureContext:true,PushManager:{},Notification:{}}); vi.stubGlobal('navigator',{serviceWorker:{getRegistration:vi.fn().mockResolvedValue(undefined)}});
  await expect(sosPushRegistration()).rejects.toThrow('installed production app'); expect(f.requestPermission).not.toHaveBeenCalled();
});
