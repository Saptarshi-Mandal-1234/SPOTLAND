import { useEffect, useRef, useState } from 'react';
import { readUsage, usageScreens, writeUsage, type Usage, type UsageScreen } from './usage';

export default function LocalUsage({ screen }: { screen: UsageScreen | null }) {
  const [usage, setUsage] = useState<Usage | null>(readUsage);
  const [message, setMessage] = useState('');
  const lastScreen = useRef<UsageScreen | null>(null);
  const enabled = usage !== null;
  useEffect(() => {
    if (!enabled) { lastScreen.current = null; return; }
    if (!screen) { lastScreen.current = null; return; }
    if (lastScreen.current === screen) return;
    lastScreen.current = screen;
    const current = readUsage(); if (current === null) { setUsage(null); setMessage('Device counters are unavailable.'); return; }
    const next = { ...current, [screen]: Math.min((current[screen] ?? 0) + 1,1000000) };
    if (writeUsage(next)) setUsage(next); else { setUsage(null); setMessage('Device storage is unavailable; counting stopped.'); }
  }, [screen,enabled]);
  return <details className="local-usage"><summary>Usage counters on this device</summary><p>Optional, off by default. Counts visits to browsing screens only. No names, locations, identifiers or visit history. Nothing is sent anywhere.</p><label><input type="checkbox" checked={enabled} onChange={event => { const next = event.target.checked ? {} : null; if (writeUsage(next)) { setUsage(next); setMessage(next === null ? 'Counters deleted.' : 'Device counters enabled.'); } else setMessage('Could not change device storage. Clear site data to remove counters.'); }}/> Keep counters on this device</label>{usage && <ul>{usageScreens.map(name => <li key={name}>{name}: {usage[name] ?? 0}</li>)}</ul>}<p role="status">{message}</p></details>;
}
