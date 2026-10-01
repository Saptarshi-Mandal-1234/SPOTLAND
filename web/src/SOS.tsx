import { useEffect, useRef, useState } from 'react';
import { encodeArea, decodeArea, sosSms, type EmergencyContact, type SosReceipt } from '../../shared/sos';
import { shareLink, validateSharePosition, type SenderShare, type SharePosition } from '../../shared/live-share';
import { freshShare, restoredShare, store } from './LiveShare';
import { createShare, prepareShareDevice, senderStatus, stopShare, updateShare } from './live-share-api';
import { closeSos, createSos, nearbyAction, respondSos, sosConfig, sosStatus, testSosPush, type NearbyState, type SosIntent } from './sos-api';
import { getContacts, getSosIntent, saveContacts, saveSosIntent } from './safety-storage';
import { disableSosPush, enableSosPush, removeBrowserSosPush, sosPushRegistration } from './sos-push';

export default function SOS({ onClose }: { onClose: () => void }) {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]), [name, setName] = useState(''), [phone, setPhone] = useState('');
  const [intent, setIntent] = useState<SosIntent | null>(null), [receipt, setReceipt] = useState<SosReceipt | null>(null), [link, setLink] = useState('');
  const [consent, setConsent] = useState(false), [broadcast, setBroadcast] = useState(false), [nearConsent, setNearConsent] = useState(false);
  const [receivingEnabled, setReceivingEnabled] = useState(false);
  const [enabled, setEnabled] = useState(false), [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [countdown, setCountdown] = useState<number | null>(null);
  const [message, setMessage] = useState('No SOS sent. Call 112 for urgent help.'), [nearMessage, setNearMessage] = useState('Nearby alerts are off.'), [nearby, setNearby] = useState<NearbyState | null>(null);
  const [pushKey, setPushKey] = useState<string | null>(null), [pushConsent, setPushConsent] = useState(false), [pushMessage, setPushMessage] = useState('Notifications are off until you enable them.');
  const [pushRegistration, setPushRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const current = useRef<SosIntent | null>(null), mounted = useRef(true), locked = useRef(false), abort = useRef<AbortController | null>(null), watch = useRef<number | null>(null), lastUpdate = useRef(0), updating = useRef(false);
  function pause() { if (watch.current !== null) navigator.geolocation?.clearWatch(watch.current); watch.current = null; }
  function remember(v: SosIntent | null) { current.current = v; setIntent(v); return saveSosIntent(v); }
  function metadata(v: SosIntent): SenderShare { return { id: v.shareId, token: v.shareNonce, expiresAt: v.shareExpiresAt }; }
  function position(signal: AbortSignal) { return new Promise<SharePosition>((resolve, reject) => {
    if (signal.aborted || document.hidden) { reject(new DOMException('Cancelled', 'AbortError')); return; }
    if (!navigator.geolocation) { reject(new Error('Location unavailable. Call 112.')); return; }
    const cancelled = () => reject(new DOMException('Cancelled', 'AbortError')); signal.addEventListener('abort', cancelled, { once: true });
    navigator.geolocation.getCurrentPosition(p => { signal.removeEventListener('abort', cancelled); try { resolve(validateSharePosition({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy })); } catch (e) { reject(e); } }, () => { signal.removeEventListener('abort', cancelled); reject(new Error('Location denied or unavailable. Retry location or Call 112.')); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  }); }
  function track(v: SosIntent, signal: AbortSignal) {
    pause(); if (!navigator.geolocation || signal.aborted || document.hidden) return;
    watch.current = navigator.geolocation.watchPosition(async p => {
      if (signal.aborted || document.hidden || updating.current || Date.now() - lastUpdate.current < 30000 || current.current?.closing || Date.now() >= v.shareExpiresAt) return;
      updating.current = true; lastUpdate.current = Date.now();
      try { await updateShare(v.shareId, validateSharePosition({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy }), signal); }
      catch (e) { if (mounted.current && !signal.aborted) setMessage(`Location update NOT sent: ${(e as Error).message}`); }
      finally { updating.current = false; }
    }, () => { if (mounted.current) setMessage('Location updates unavailable. Retry location; Call 112 for urgent help.'); }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 });
  }
  useEffect(() => {
    mounted.current = true;
    void Promise.all([getContacts(), getSosIntent()]).then(([c, v]) => { if (!mounted.current) return; setContacts(c); current.current = v; setIntent(v); setReady(true); if (v) setMessage('Previous SOS needs checking. Retry or mark safe. Location updates stay paused until you consent.'); }).catch(e => { if (mounted.current) setMessage((e as Error).message); });
    void sosConfig().then(config => { if (mounted.current) { setEnabled(config.enabled); setReceivingEnabled(config.receivingEnabled); setPushKey(config.pushPublicKey); } }).catch(() => { if (mounted.current) setNearMessage('Server unavailable. Nearby alerts are not confirmed. Contacts remain on your device.'); });
    const checkPush = () => { void sosPushRegistration().then(registration => { if (mounted.current) setPushRegistration(registration); }).catch(error => { if (mounted.current) setPushMessage((error as Error).message); }); };
    checkPush(); navigator.serviceWorker?.addEventListener('controllerchange', checkPush);
    void nearbyAction({ action: 'status' }).then(state => { if (mounted.current && state.expiresAt > Date.now()) { setNearby(state); setNearMessage('Restored existing nearby consent until ' + new Date(state.expiresAt).toLocaleTimeString() + '. Precise location remains off.'); } }).catch(() => { /* No signed device or no connection: leave receiving off until confirmed. */ });
    const hidden = () => { if (document.hidden) { pause(); setCountdown(null); abort.current?.abort(); } };
    document.addEventListener('visibilitychange', hidden);
    return () => { mounted.current = false; abort.current?.abort(); pause(); document.removeEventListener('visibilitychange', hidden); navigator.serviceWorker?.removeEventListener('controllerchange', checkPush); };
  }, []);
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) { setCountdown(null); void send(); return; }
    const timer = window.setTimeout(() => setCountdown(countdown - 1), 1000); return () => clearTimeout(timer);
  }, [countdown]);
  async function refresh() {
    if (document.hidden || locked.current || !mounted.current) return;
    try { if (nearby?.expiresAt) { const r = await nearbyAction({ action: 'list' }); if (mounted.current) { setNearby(r); setNearMessage(r.expiresAt ? 'Foreground alerts refreshed. ' + (r.pushEnabled ? 'Push subscription registered; delivery is not guaranteed.' : 'Push notifications are off.') : 'Nearby consent expired. Enable again to receive alerts.'); } } } catch (e) { if (mounted.current) setNearMessage(`Refresh NOT confirmed: ${(e as Error).message}`); }
    const v = current.current;
    if (v && Date.now() >= v.shareExpiresAt) { pause(); setLink(''); setMessage('Private sharing expired. Close this SOS before starting another. Call 112 if help is still needed.'); }
    if (v?.closing) { await end(); return; }
    if (v?.broadcast && v.geohash && Date.now() < v.startedAt + 900000) {
      try { const r = await createSos(v); if (mounted.current && current.current?.id === v.id && !current.current.closing) { setReceipt(r); setMessage(`Nearby alert ${r.status === 'active' ? 'sent to server' : r.status}. This does not confirm anyone received it. Call 112.`); } } catch (e) { if (mounted.current) setMessage(`Nearby NOT confirmed; queued for retry: ${(e as Error).message}`); }
    } else if (v?.broadcast && receipt?.status === 'active') { try { const r = await sosStatus(v.id); if (mounted.current) setReceipt(r); } catch (e) { if (mounted.current) setMessage(`Alert status NOT confirmed: ${(e as Error).message}`); } }
  }
  useEffect(() => { const timer = window.setInterval(() => void refresh(), 30000); const retry = () => void refresh(); window.addEventListener('online', retry); document.addEventListener('visibilitychange', retry); return () => { clearInterval(timer); window.removeEventListener('online', retry); document.removeEventListener('visibilitychange', retry); }; }, [nearby?.expiresAt, receipt?.status]);
  async function send() {
    if (locked.current || !consent || !ready || document.hidden) return;
    locked.current = true; setBusy(true); const controller = new AbortController(); abort.current = controller; const newSos = !current.current; let composer = ''; setMessage('SOS NOT confirmed. Getting location and preparing private share…');
    try {
      let v = current.current;
      if (v?.closing) throw new Error('Finish stopping the previous SOS first.');
      if (!v) { const s = restoredShare() || freshShare(1); v = { id: crypto.randomUUID(), startedAt: Date.now(), broadcast, closing: false, shareId: s.id, shareNonce: s.token, shareExpiresAt: s.expiresAt }; await remember(v); }
      const p = await position(controller.signal); if (controller.signal.aborted || document.hidden) throw new Error('Keep this screen visible.');
      await prepareShareDevice(controller.signal);
      let s, created = false;
      try { s = await senderStatus(metadata(v), controller.signal); } catch (e) { if (controller.signal.aborted || (e as Error).message !== 'Sharing has stopped or expired.') throw e; s = await createShare(metadata(v), 1, p, controller.signal); created = true; }
      v = { ...v, shareNonce: s.token, shareExpiresAt: s.expiresAt, geohash: encodeArea(p.lat, p.lon) }; await remember(v); store(metadata(v));
      const privateLink = shareLink(s.token, location.origin); setLink(privateLink); if (newSos && contacts.length) composer = sosSms(contacts, privateLink, /iPhone|iPad/.test(navigator.userAgent)); if (!created) await updateShare(v.shareId, p, controller.signal); lastUpdate.current = Date.now(); track(v, controller.signal);
      if (v.broadcast) { const r = await createSos(v, controller.signal); setReceipt(r); setMessage('Nearby alert sent to server. Open a message composer below to notify contacts; delivery is not confirmed. Call 112.'); }
      else setMessage('Private link ready. Open a message composer below and tap Send yourself. No nearby alert sent.');
    } catch (e) { if (mounted.current) setMessage(`SOS NOT fully confirmed: ${(e as Error).message} Retry or Call 112. Pending nearby alerts retry while this screen is visible.`); }
    finally { locked.current = false; if (mounted.current) { setBusy(false); if (composer && !controller.signal.aborted) { try { location.href = composer; } catch { setMessage('SMS composer unavailable. Use Open SMS composer below. Nothing was sent automatically.'); } } } }
  }
  async function end() {
    if (locked.current || !current.current) return; locked.current = true; setBusy(true); pause(); abort.current?.abort();
    try { const v = { ...current.current, closing: true }; await remember(v); const results = await Promise.allSettled([v.broadcast ? closeSos(v.id) : Promise.resolve(), stopShare(metadata(v))]); const failed = results.find(r => r.status === 'rejected'); if (failed?.status === 'rejected') throw failed.reason; await remember(null); store(null); setLink(''); setReceipt(null); setMessage('SOS closed and private share stopped.'); }
    catch (e) { if (mounted.current) setMessage(`Stop NOT confirmed: ${(e as Error).message} Retry “I’m safe”; the link may remain accessible until expiry.`); }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  }
  async function changeNearby(off = false) {
    if (locked.current || (!off && !nearConsent)) return; locked.current = true; setBusy(true); const controller = new AbortController(); abort.current = controller;
    try { let data: unknown = { action: 'off' }; if (!off) { const p = await position(controller.signal); await prepareShareDevice(controller.signal); data = { action: 'optin', consent: true, geohash: encodeArea(p.lat, p.lon) }; } const r = await nearbyAction(data, controller.signal); if (mounted.current) { setNearby(r); setNearMessage(off ? 'Nearby alerts disabled on server.' : 'Enabled for one hour. Foreground polling works while this screen is visible; opt in separately to push below. Only your approximate area is sent.'); } if (off) { setPushConsent(false); await removeBrowserSosPush(pushRegistration); setPushMessage('Notifications disabled. Browser permission may remain granted; change browser settings to revoke it.'); } }
    catch (e) { if (mounted.current) setNearMessage(`Change NOT confirmed: ${(e as Error).message}`); } finally { locked.current = false; if (mounted.current) setBusy(false); }
  }
  async function changePush(off = false) {
    if (locked.current || (!off && (!pushConsent || !pushKey || !pushRegistration || !nearby || nearby.expiresAt <= Date.now()))) return;
    locked.current = true; setBusy(true); const controller = new AbortController(); abort.current = controller;
    try {
      const state = await (off ? disableSosPush(pushRegistration, controller.signal) : enableSosPush(pushRegistration!, pushKey!, controller.signal));
      if (mounted.current) { setNearby(state); setPushMessage(off ? 'Notifications disabled on server and browser. Browser permission may remain granted.' : 'Push subscription registered until nearby consent expires. Notifications can be delayed or missed; Call 112 for urgent help.'); if (off) setPushConsent(false); }
    } catch (error) { if (mounted.current) setPushMessage(`Notification change NOT fully confirmed: ${(error as Error).message}`); }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  }
  async function editContacts(c: EmergencyContact[]) { try { await saveContacts(c); setContacts(c); setName(''); setPhone(''); setMessage('Contacts saved only on this device.'); } catch (e) { setMessage((e as Error).message); } }
  async function testPush() {
    if (locked.current) return;
    locked.current = true; setBusy(true); const controller = new AbortController(); abort.current = controller;
    try { const result = await testSosPush(controller.signal); if (mounted.current) setPushMessage(result.message); }
    catch (error) { if (mounted.current) setPushMessage(`Test NOT confirmed: ${(error as Error).message}`); }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  }
  const text = `I need help. Please call me or Call 112. My SPOTLAND location: ${link}`;
  return <section className="safety live-share sos" aria-label="SOS safety"><header className="safety-header"><button disabled={busy} onClick={onClose}>← Home</button><strong>SOS</strong><a href="tel:112">Call 112</a></header><div className="safety-content"><h1>Emergency help</h1><p>This app does not replace emergency services. <a href="tel:112">Call 112</a> for urgent help.</p><p>Location updates work only while this screen stays open and visible. Background location is unreliable. SMS cannot be sent silently; your carrier may charge for SMS.</p><p role="status">{message}</p>
    <label><input type="checkbox" checked={consent} disabled={busy} onChange={e => { setConsent(e.target.checked); if (!e.target.checked) { setCountdown(null); setMessage("Location consent removed. No new SOS sent."); } }}/> I consent to precise live location in a private contact link, accessible to anyone with that link until stopped or expired.</label>
    {countdown !== null ? <div><p role="alert">SOS starts in {countdown} seconds.</p><button onClick={() => { setCountdown(null); setMessage('Cancelled. No new SOS sent.'); }}>Cancel SOS</button></div> : <button className="sos-start" disabled={!ready || !consent || busy || !!intent} onClick={() => setCountdown(5)}>SOS — get help</button>}
    <label><input type="checkbox" checked={broadcast} disabled={!!intent || busy || !enabled} onChange={e => setBroadcast(e.target.checked)}/> Also broadcast an anonymous approximate area to opted-in devices within the server’s fixed 2 km radius for one hour.</label>
    {!enabled && <p>Nearby broadcast unavailable until server configuration is ready.</p>}
    <p>If contacts are saved, SOS attempts to open their SMS composer after the private link is confirmed. You must tap Send. If your browser blocks the composer, use the button below.</p>

    {busy && !intent?.closing && <button onClick={() => { abort.current?.abort(); pause(); setMessage('Preparation cancelled. If a request reached the server, use “I’m safe” to confirm closure.'); }}>Cancel preparation</button>}
    {intent && <><button disabled={busy || !consent || intent.closing} onClick={() => void send()}>Retry / resume location</button><button className="share-stop" disabled={busy} onClick={() => void end()}>I’m safe — close SOS and stop share</button><p>Private share expires {new Date(intent.shareExpiresAt).toLocaleString()}. Nearby status: {receipt?.status || (intent.broadcast ? 'not confirmed / queued' : 'off')}.</p>{receipt && <p role="status">Push services accepted: {receipt.push.sent}; queued: {receipt.push.pending}; failed: {receipt.push.failed}; eligible: {receipt.push.eligible}. Acceptance does not confirm notification display, reading or assistance.</p>}</>}
    {link && <><label>Private contact link<input readOnly value={link}/></label><div className="share-actions">{contacts.length > 0 && <a href={sosSms(contacts, link, /iPhone|iPad/.test(navigator.userAgent))}>Open SMS composer ({contacts.length} contacts)</a>}<a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">Open WhatsApp</a><button onClick={() => { if (navigator.share) void navigator.share({ text, url: link }).catch(() => setMessage('Share cancelled or unavailable. Use the message links.')); else setMessage('Share sheet unavailable. Copy the private link above.'); }}>Share with contacts</button></div><p>You must choose recipients and send. Opening a composer does not confirm delivery.</p></>}
    <h2>Emergency contacts</h2><p>Up to five, kept only in this device’s IndexedDB. They are never uploaded.</p>{contacts.map((c, n) => <p key={c.phone}>{c.name}: {c.phone} <button onClick={() => void editContacts(contacts.filter((_, i) => i !== n))}>Remove {c.name}</button></p>)}<form onSubmit={e => { e.preventDefault(); void editContacts([...contacts, { name, phone }]); }}><label>Name<input value={name} maxLength={60} onChange={e => setName(e.target.value)} required/></label><label>Phone<input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required/></label><button disabled={!ready || contacts.length >= 5}>Save contact on device</button></form>
    <h2>Receive nearby alerts</h2><label><input type="checkbox" checked={nearConsent} onChange={e => setNearConsent(e.target.checked)}/> I consent to sharing my approximate area for one hour to receive nearby alerts. Precise location is not broadcast.</label><button disabled={!receivingEnabled || busy || !nearConsent} onClick={() => void changeNearby()}>Enable / refresh approximate area</button><button disabled={!receivingEnabled || busy} onClick={() => void changeNearby(true)}>Turn nearby alerts off</button><p role="status">{nearMessage}</p><p>Foreground polling checks every 30 seconds. Push can work when the app is closed, but your approximate area is not refreshed in the background and consent expires after one hour. iPhone push requires a Home Screen install.</p>
    <h3>Optional push notifications</h3>{!pushKey && <p>Push is unavailable until the operator configures Web Push keys and contact.</p>}<label><input type="checkbox" checked={pushConsent} disabled={busy} onChange={e => setPushConsent(e.target.checked)}/> I consent to nearby SOS notifications and storing this browser’s push subscription for the remaining nearby-consent period. Browser push services process the subscription and encrypted messages.</label><button disabled={busy || !pushKey || !pushRegistration || !pushConsent || !nearby || nearby.expiresAt <= Date.now()} onClick={() => void changePush()}>Enable push notifications</button><button disabled={busy || !receivingEnabled} onClick={() => void changePush(true)}>Turn push notifications off</button><button disabled={busy || !pushKey || !nearby?.pushEnabled || nearby.expiresAt <= Date.now()} onClick={() => void testPush()}>Send test notification to this device</button><p>The test contacts only this device; it creates no SOS alert or nearby broadcast.</p><p role="status">{pushMessage}</p><p>Server subscription: {nearby?.pushEnabled ? 'registered' : 'off / not confirmed'}. Generic notifications contain no precise location, contact names or private share links. Open the app to check whether the alert remains active.</p>
    {nearby?.alerts.map(a => { const area = decodeArea(a.geohash); return <article key={a.id}><h3>Nearby SOS — approximate area</h3><p>About {a.distanceKm} km · {a.direction} · {new Date(a.createdAt).toLocaleTimeString()}. Expires {new Date(a.expiresAt).toLocaleTimeString()}.</p><a href="tel:112">Call 112</a> <a href={`https://www.openstreetmap.org/?mlat=${area.lat}&mlon=${area.lon}#map=15/${area.lat}/${area.lon}`} target="_blank" rel="noreferrer">Approximate map · © OpenStreetMap</a>{(['help', 'report'] as const).map(action => <button key={action} onClick={() => { void respondSos(a.id, action).then(r => { setNearMessage(r.message || 'Report recorded. Three distinct device reports hide the alert.'); return refresh(); }).catch(e => setNearMessage((e as Error).message)); }}>{action === 'help' ? 'I can help' : 'Report false alarm'}</button>)}</article>; })}
    <p><a href="/privacy.html">Privacy policy</a> · Assistance and message delivery are never guaranteed.</p></div></section>;
}
