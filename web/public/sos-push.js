/* Loaded by the PWA worker; notification content contains no precise location. */
self.addEventListener('push', event => {
  let data; try { data = event.data?.json(); } catch { return; }
  if (!data || !['spotland-sos', 'spotland-push-test'].includes(data.type) || typeof data.id !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(data.id) || typeof data.expiresAt !== 'number' || !Number.isFinite(data.expiresAt)) return;
  const expired = data.expiresAt <= Date.now();
  const test = data.type === 'spotland-push-test';
  event.waitUntil(self.registration.showNotification(expired ? 'SPOTLAND notification expired' : test ? 'SPOTLAND notification test' : 'SPOTLAND nearby SOS', { body: expired ? 'This delayed notification has expired. It is not a current alert.' : test ? 'This device received the notification test. No SOS was created or broadcast.' : 'A nearby SOS was reported. Open the app to check its current status. Call 112 for urgent help.', tag: 'sos-' + data.id, icon: '/icons/spotland-192.png', data: { expiresAt: data.expiresAt }, renotify: false }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close(); if (event.notification.data?.expiresAt <= Date.now()) return;
  event.waitUntil((async () => { const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true }); const existing = windows.find(w => new URL(w.url).origin === self.location.origin); if (existing) { await existing.navigate('/#sos'); await existing.focus(); } else await self.clients.openWindow('/#sos'); })());
});
