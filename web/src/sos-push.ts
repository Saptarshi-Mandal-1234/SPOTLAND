import { nearbyAction } from './sos-api';

export async function sosPushRegistration(): Promise<ServiceWorkerRegistration> {
  if (!window.isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) throw new Error('Push is unavailable in this browser. Use foreground alerts. On iPhone, install SPOTLAND on the Home Screen first.');
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration?.active) throw new Error('Push needs the installed production app. Reload once app shell setup is ready; development mode does not install a service worker.');
  return registration;
}

export async function enableSosPush(registration: ServiceWorkerRegistration, key: string, signal?: AbortSignal) {
  if (!/^[A-Za-z0-9_-]{87}$/.test(key)) throw new Error('Push configuration is unavailable.');
  // Invoke the permission prompt directly from the user's button click, before any await.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications were not allowed. Enable them in browser settings to retry; foreground alerts still work.');
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  const bytes = Uint8Array.from(atob(key.replace(/-/g, '+').replace(/_/g, '/') + '='), c => c.charCodeAt(0));
  let subscription = await registration.pushManager.getSubscription();
  const created = !subscription;
  const previousKey = subscription?.options.applicationServerKey;
  if (previousKey && (previousKey.byteLength !== bytes.byteLength || !new Uint8Array(previousKey).every((value, index) => value === bytes[index]))) throw new Error('Push keys changed. Turn notifications off, then enable them again.');
  subscription ||= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes.buffer });
  try { return await nearbyAction({ action: 'subscribe', consent: true, subscription: subscription.toJSON() }, signal); }
  catch (error) { if (created) await subscription.unsubscribe().catch(() => false); throw error; }
}

export async function removeBrowserSosPush(registration?: ServiceWorkerRegistration | null) {
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription && !await subscription.unsubscribe()) throw new Error('Server notifications are off, but the browser subscription could not be removed. Retry turning notifications off.');
}

export async function disableSosPush(registration?: ServiceWorkerRegistration | null, signal?: AbortSignal) {
  const state = await nearbyAction({ action: 'unsubscribe' }, signal);
  await removeBrowserSosPush(registration);
  return state;
}
