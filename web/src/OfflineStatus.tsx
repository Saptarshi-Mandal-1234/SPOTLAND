/// <reference types="vite-plugin-pwa/client" />
import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { clearOfflineData } from './offline';
import { useOnline } from './useOnline';
export default function OfflineStatus() {
  const online = useOnline(); const [ready, setReady] = useState(false); const [update, setUpdate] = useState<(() => Promise<void>) | null>(null); const [message, setMessage] = useState('');
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    let active = true;
    const updateSW = registerSW({ onOfflineReady: () => { if (active) setReady(true); }, onNeedRefresh: () => { if (active) setUpdate(() => () => updateSW(true)); }, onRegisterError: () => { if (active) setMessage('Offline app setup failed. Reconnect and reload to retry.'); } });
    // Also show readiness on subsequent visits, after the service worker controls this page.
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) setReady(true);
    return () => { active = false; };
  }, []);
  return <aside className="offline-status" aria-label="Offline storage"><p role="status">{online ? ready ? 'App shell ready offline. Saved copies refresh on reconnect.' : import.meta.env.PROD ? 'Online. Preparing offline app shell…' : 'Online. Offline app setup requires the production build.' : 'Offline. Saved places and the last area may be available; live tools need a connection.'} {message}</p><details><summary>Offline copies on this device</summary><p>Up to seven days of saved places and one coarse browsing area. On a shared device, clear these copies. Emergency contacts are kept separately. Favorite changes and trip saving need a connection. Street tiles are not downloaded.</p><button onClick={() => setMessage(clearOfflineData() ? 'Offline place copies cleared. Your server favorites and emergency contacts are unchanged.' : 'Could not clear offline copies: browser storage is blocked.')}>Clear offline place copies</button></details>{update && <button onClick={() => void update()}>Update app (reloads this page)</button>}</aside>;
}
