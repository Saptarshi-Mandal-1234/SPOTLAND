import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createShare, prepareShareDevice, readShare, senderStatus, stopShare, updateShare } from './live-share-api';
import { shareHours, shareInterval, shareLink, shareState, validateSharePosition, type SenderShare, type SharePosition, type ShareSnapshot } from '../../shared/live-share';
import type { Place } from '../../shared/places';
const MapCanvas = lazy(() => import('./MapCanvas'));
const storageKey = 'spotland-live-share';
export function restoredShare(): SenderShare | null {
  try { const s = JSON.parse(sessionStorage.getItem(storageKey) || 'null'); return s && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(s.id) && /^[A-Za-z0-9_-]{43}$/.test(s.token) && typeof s.expiresAt === 'number' && s.expiresAt > Date.now() ? s : null; } catch { return null; }
}
export function store(share: SenderShare | null) { try { if (share) sessionStorage.setItem(storageKey, JSON.stringify(share)); else sessionStorage.removeItem(storageKey); } catch { /* Sharing still works in this tab without session storage. */ } }
export function freshShare(hours: number): SenderShare { return { id: crypto.randomUUID(), token: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''), expiresAt: Date.now() + hours * 3600000 }; }
const position = (p: GeolocationPosition) => validateSharePosition({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy });
const geoError = (e: GeolocationPositionError) => e.code === 1 ? 'Location permission was denied. Allow it in browser settings, then retry.' : e.code === 2 ? 'Location is unavailable. Check location services and retry.' : 'Location timed out. Retry in an open area.';
export default function LiveShare({ onClose, recipientToken }: { onClose: () => void; recipientToken?: string }) {
  const [share, setShare] = useState<SenderShare | null>(() => recipientToken !== undefined ? null : restoredShare()); const active = useRef(share);
  const [snapshot, setSnapshot] = useState<ShareSnapshot | null>(null); const [hours, setHours] = useState(1); const [consent, setConsent] = useState(false); const [running, setRunning] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(recipientToken !== undefined ? 'Loading shared location…' : share ? 'A share may still be active. Resume updates or stop it. Location stays paused until you choose Resume.' : 'Location is off until you choose Start sharing.');
  const [now, setNow] = useState(Date.now()); const [keepAwake, setKeepAwake] = useState(false); const [wakeMessage, setWakeMessage] = useState('');
  const mounted = useRef(true), watch = useRef<number | null>(null), latest = useRef<SharePosition | null>(null), latestAt = useRef(0), lastSent = useRef(0), sending = useRef(false), lock = useRef(false), updates = useRef<AbortController | null>(null), paused = useRef(true);
  const awake = useRef<WakeLockSentinel | null>(null);
  const startRequest = useRef<AbortController | null>(null); const [starting, setStarting] = useState(false);
  function pauseUpdates() { paused.current = true; if (watch.current !== null) navigator.geolocation?.clearWatch(watch.current); watch.current = null; latest.current = null; updates.current?.abort(); updates.current = null; void awake.current?.release(); awake.current = null; }
  function forget() { pauseUpdates(); active.current = null; store(null); if (mounted.current) { setShare(null); setSnapshot(null); setRunning(false); } }
  useEffect(() => { mounted.current = true; const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => { mounted.current = false; startRequest.current?.abort(); window.clearInterval(timer); pauseUpdates(); }; }, []);
  useEffect(() => { if (share && now >= share.expiresAt) { forget(); setMessage('Sharing expired. The link no longer reveals a location.'); } }, [now, share]);
  useEffect(() => {
    if (recipientToken === undefined) return;
    let disposed = false, loading = false; const abort = new AbortController();
    async function refresh() { if (loading || document.hidden || disposed) return; loading = true; try { const result = await readShare(recipientToken!, abort.signal); if (!disposed) { setSnapshot(result); setMessage('Anyone with this link can see the latest shared position until it stops or expires.'); } } catch (error) { if (!disposed) { setSnapshot(null); setMessage((error as Error).message); } } finally { loading = false; } }
    void refresh(); const timer = window.setInterval(() => void refresh(), shareInterval); const visible = () => void refresh(); document.addEventListener('visibilitychange', visible);
    return () => { disposed = true; abort.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [recipientToken]);
  useEffect(() => {
    if (!running) return;
    const changed = () => { if (document.hidden) { pauseUpdates(); setMessage('Updates paused while the app is hidden. Recipients may see a stale position.'); } else { startWatch(); } };
    document.addEventListener('visibilitychange', changed);
    const timer = window.setInterval(() => void sendLatest(), shareInterval);
    return () => { document.removeEventListener('visibilitychange', changed); window.clearInterval(timer); };
  }, [running]);
  useEffect(() => {
    if (!running || !keepAwake) { void awake.current?.release(); awake.current = null; return; }
    let disposed = false;
    async function acquire() { if (document.hidden || disposed || awake.current) return; if (!navigator.wakeLock) { setWakeMessage('Screen Wake Lock is unavailable. Keep the app open manually.'); return; } try { const sentinel = await navigator.wakeLock.request('screen'); if (disposed) { await sentinel.release(); return; } awake.current = sentinel; sentinel.addEventListener('release', () => { if (awake.current === sentinel) awake.current = null; }); setWakeMessage('Screen wake requested. The browser may release it to save power.'); } catch { if (!disposed) setWakeMessage('Could not keep the screen awake. Keep the app open manually.'); } }
    void acquire(); document.addEventListener('visibilitychange', acquire);
    return () => { disposed = true; document.removeEventListener('visibilitychange', acquire); void awake.current?.release(); awake.current = null; };
  }, [running, keepAwake]);
  async function sendLatest() {
    const current = active.current;
    if (paused.current || document.hidden || !current || !latest.current || Date.now() >= current.expiresAt || sending.current || Date.now() - lastSent.current < shareInterval || Date.now() - latestAt.current > 60000) return;
    sending.current = true; lastSent.current = Date.now(); const signal = updates.current?.signal;
    try { const result = await updateShare(current.id, latest.current, signal); if (mounted.current && !signal?.aborted && active.current?.id === current.id) { setSnapshot(result); setMessage('Location update sent.'); } } catch (error) { if (mounted.current && !signal?.aborted) setMessage(`Update not sent: ${(error as Error).message} Retrying while this screen stays open.`); } finally { sending.current = false; }
  }
  function startWatch() {
    if (!active.current || document.hidden || !navigator.geolocation) return;
    pauseUpdates(); paused.current = false; updates.current = new AbortController();
    const signal = updates.current.signal;
    watch.current = navigator.geolocation.watchPosition(p => { if (signal.aborted || !mounted.current) return; try { latest.current = position(p); latestAt.current = Date.now(); void sendLatest(); } catch (error) { latest.current = null; setMessage((error as Error).message); } }, error => { if (signal.aborted || !mounted.current) return; latest.current = null; setMessage(`${geoError(error)} Updates are not being sent. Use Retry location after changing browser settings.`); }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 });
  }
  async function start() {
    if (lock.current || !consent || !navigator.geolocation) return;
    lock.current = true; setBusy(true); setStarting(true); setMessage('Waiting for your location permission and a position…');
    const abort = new AbortController(); startRequest.current = abort; updates.current = abort;
    try {
      const initial = await new Promise<SharePosition>((resolve, reject) => {
        const cancelled = () => reject(new DOMException('Cancelled', 'AbortError')); abort.signal.addEventListener('abort', cancelled, { once: true });
        navigator.geolocation.getCurrentPosition(p => { abort.signal.removeEventListener('abort', cancelled); try { resolve(position(p)); } catch (error) { reject(error); } }, e => { abort.signal.removeEventListener('abort', cancelled); reject(new Error(geoError(e))); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
      });
      if (!mounted.current || abort.signal.aborted) return;
      if (document.hidden) throw new Error('Keep the app visible while starting sharing.');
      await prepareShareDevice(abort.signal);
      if (document.hidden || abort.signal.aborted || !mounted.current) throw new Error('Keep the app visible while starting sharing.');
      const current = active.current || freshShare(hours); active.current = current; store(current); setShare(current);
      const result = share ? await senderStatus(current, abort.signal) : await createShare(current, hours, initial, abort.signal);
      if (!mounted.current || abort.signal.aborted) return;
      if ('token' in result && typeof result.token === 'string') current.token = result.token;
      current.expiresAt = result.expiresAt; store(current); setShare({ ...current }); setSnapshot(result); lastSent.current = share ? 0 : Date.now(); setRunning(true); startWatch(); setMessage('Sharing is active. Only send this link to people you trust.');
    } catch (error) { if (mounted.current && !abort.signal.aborted) setMessage(`Sharing not confirmed: ${(error as Error).message}${active.current ? ' Stop this link or check/resume it before starting another.' : ''}`); } finally { if (startRequest.current === abort) { startRequest.current = null; lock.current = false; if (mounted.current) { setBusy(false); setStarting(false); } } }
  }
  async function stop() {
    if (lock.current || !active.current) return; lock.current = true; setBusy(true); pauseUpdates(); setRunning(false); setMessage('Updates stopped on this device. Confirming server deletion…');
    try { await stopShare(active.current); if (mounted.current) { forget(); setMessage('Sharing stopped. The link no longer reveals a location.'); } } catch (error) { if (mounted.current) setMessage(`Server stop NOT confirmed: ${(error as Error).message} Retry Stop; the link may remain accessible until expiry.`); } finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  const link = share ? shareLink(share.token, location.origin) : '', state = snapshot ? shareState(snapshot, now) : null;
  async function copyLink() { try { if (!navigator.clipboard) throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(link); setMessage('Link copied. Share only with people you trust.'); } catch { setMessage('Copy failed. Select the link and copy it manually.'); } }
  const places: Place[] = snapshot && state !== 'expired' ? [{ id: 'shared-location', name: 'Latest shared location', category: 'viewpoint', lat: snapshot.position.lat, lon: snapshot.position.lon, address: '', hours: '' }] : [];
  return <section className="safety live-share" aria-label={recipientToken !== undefined ? 'Shared location' : 'Live location sharing'}><header className="safety-header"><button disabled={busy} onClick={onClose}>← Home</button><strong>Location sharing</strong><a href="tel:112">Call 112</a></header><div className="safety-content"><h1>{recipientToken !== undefined ? 'Shared location' : 'Share your location'}</h1><p>This app does not replace emergency services. Call 112 for urgent help.</p><p>Updates work only while this sharing screen is open and visible. Background location is unreliable. SMS and WhatsApp require you to send the message yourself.</p><p role="status" aria-live="polite">{message}</p>
    {recipientToken === undefined && <><label>Expires after <select value={hours} disabled={!!share || busy} onChange={e => setHours(Number(e.target.value))}>{shareHours.map(h => <option key={h} value={h}>{h} hour{h > 1 ? 's' : ''}</option>)}</select></label><label className="share-consent"><input type="checkbox" checked={consent} disabled={running || busy} onChange={e => setConsent(e.target.checked)}/> I agree to send my precise location to SPOTLAND and show it to anyone with my link. The map provider can see the map area. Only the latest position is kept until Stop or expiry.</label><p><a href="/privacy.html" target="_blank" rel="noreferrer">Location privacy details</a></p>{!navigator.geolocation && <p role="alert">Location is unavailable in this browser. Use HTTPS or a supported localhost browser.</p>}
      {!running && <button disabled={!consent || busy || !navigator.geolocation} onClick={() => void start()}>{busy ? 'Please wait…' : share ? 'Check share & resume updates' : 'Start sharing'}</button>}{starting && <button onClick={() => { startRequest.current?.abort(); startRequest.current = null; pauseUpdates(); lock.current = false; setBusy(false); setStarting(false); setMessage('Start/resume cancelled. Any existing link may remain active; use Stop sharing to revoke it.'); }}>Cancel start / resume</button>}{running && <button disabled={busy} onClick={() => startWatch()}>Retry location</button>}{share && <><button className="share-stop" disabled={busy} onClick={() => void stop()}>Stop sharing</button><p>Expires: {new Date(share.expiresAt).toLocaleString('en-IN')}</p><p>Leaving this screen or closing the tab pauses updates; it does not revoke the link. Use Stop sharing to revoke it. Reopen this screen to resume.</p>{snapshot && <><label>Private share link <input readOnly value={link}/></label><div className="share-actions"><button onClick={() => void copyLink()}>Copy link</button>{!!navigator.share && <button onClick={() => void navigator.share({ title: 'SPOTLAND live location', text: 'My location while SPOTLAND is open:', url: link }).catch(() => setMessage('Sharing was cancelled or unavailable. Copy the link instead.'))}>Share link</button>}<a href={`https://wa.me/?text=${encodeURIComponent(`My SPOTLAND location: ${link}`)}`} target="_blank" rel="noreferrer">WhatsApp</a><a href={`sms:?body=${encodeURIComponent(`My SPOTLAND location: ${link}`)}`}>Open SMS composer</a></div></>}
      <label><input type="checkbox" checked={keepAwake} onChange={e => setKeepAwake(e.target.checked)}/> Keep screen awake while sharing, if supported</label><p role="status">{wakeMessage}</p></>}
    </>}
    {snapshot && state !== 'expired' && <><h2>Latest position</h2><p>Updated: {new Date(snapshot.updatedAt).toLocaleString('en-IN')} · accuracy about {Math.round(snapshot.position.accuracy)} metres</p>{state === 'stale' && <p role="alert">STALE LOCATION: no recent update. The sender may be offline, have closed the app, or be unable to update.</p>}<p>Latitude {snapshot.position.lat.toFixed(5)}, longitude {snapshot.position.lon.toFixed(5)}. This is the latest reported position, not a guarantee of current whereabouts.</p><div className="share-map"><Suspense fallback={<p>Loading map…</p>}><MapCanvas center={snapshot.position} places={places} plain onSelect={() => {}} onMove={() => {}}/></Suspense></div><p>© OpenStreetMap contributors · Map coverage varies.</p></>}
    {state === 'expired' && <p role="alert">This link has expired. The location is no longer displayed.</p>}
  </div></section>;
}
