import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { APP_NAME } from './config';
import { checkHealth } from './api';
import { Sticker } from './design';
import { useAccount } from './AccountContext';
import { useOnline } from './useOnline';
import LocalUsage from './LocalUsage';

const Explore = lazy(() => import('./Explore'));
const Safety = lazy(() => import('./Safety'));
const SpecialDays = lazy(() => import('./SpecialDays'));
const Events = lazy(() => import('./Events'));
const Venues = lazy(() => import('./Venues'));
const Account = lazy(() => import('./Account'));
const TripPlanner = lazy(() => import('./TripPlanner'));
const SOS = lazy(() => import('./SOS'));
const LiveShare = lazy(() => import('./LiveShare'));
export function App() {
  const account = useAccount();
  const [sos, setSos] = useState(() => location.hash === '#sos');
  useEffect(() => { const changed = () => { if (location.hash === '#sos') { setSos(true); setSharing(false); } }; window.addEventListener('hashchange', changed); return () => window.removeEventListener('hashchange', changed); }, []);
  const [recipientToken, setRecipientToken] = useState<string | undefined>(() => location.hash.startsWith('#live=') ? location.hash.slice(6) : undefined);
  const [sharing, setSharing] = useState(() => location.hash.startsWith('#live='));
  useEffect(() => { const changed = () => { if (location.hash.startsWith('#live=')) { setSos(false); setRecipientToken(location.hash.slice(6)); setSharing(true); account.setOpen(false); } }; window.addEventListener('hashchange', changed); return () => window.removeEventListener('hashchange', changed); }, [account.setOpen]);
  const [planning, setPlanning] = useState(false);
  const [venues, setVenues] = useState(false);
  const [safety, setSafety] = useState(false);
  const [calendar, setCalendar] = useState(false);
  const [events, setEvents] = useState(false);
  const [exploring, setExploring] = useState(false);
  const [hub, setHub] = useState(() => location.pathname === '/features');
  useEffect(() => { const changed = () => setHub(location.pathname === '/features'); window.addEventListener('popstate', changed); return () => window.removeEventListener('popstate', changed); }, []);
  const [dark, setDark] = useState(() => { try { return localStorage.getItem('theme') === 'dark'; } catch { return false; } });
  const [status, setStatus] = useState('Checking…');
  const online = useOnline();
  const content = useRef<HTMLElement>(null);
  const screenKey = [sos,sharing,planning,venues,safety,calendar,events,exploring,hub,account.open].join(':');
  const previousScreen = useRef(screenKey);
  useEffect(() => {
    if (previousScreen.current === screenKey) return;
    previousScreen.current = screenKey;
    content.current?.focus();
  }, [screenKey]);
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch { /* Theme still works when storage is unavailable. */ } }, [dark]);
  useEffect(() => {
    const controller = new AbortController();
    setStatus(online ? 'Checking…' : 'Offline');
    if (online) checkHealth(controller.signal).then(value => { if (!controller.signal.aborted) setStatus(value); }).catch(() => { if (!controller.signal.aborted) setStatus('Temporarily unavailable'); });
    return () => controller.abort();
  }, [online]);
  return <>
    <a className="skip" href="#app-content">Skip to content</a>
    <main id="app-content" className="app-shell" tabIndex={-1} ref={content}>
    {sos && <Suspense fallback={<div className="safety-fallback"><a href="tel:112">Call 112</a><p>Loading SOS…</p></div>}><SOS onClose={() => { setSos(false); if (location.hash === "#sos") history.replaceState(null, "", location.pathname + location.search); }}/></Suspense>}
    {sharing && <Suspense fallback={<div className="safety-fallback"><a href="tel:112">Call 112</a><p>Loading location sharing…</p></div>}><LiveShare key={recipientToken === undefined ? 'sender' : 'recipient:' + recipientToken} recipientToken={recipientToken} onClose={() => { setSharing(false); setRecipientToken(undefined); if (location.hash.startsWith('#live=')) history.replaceState(null, '', location.pathname + location.search); }}/></Suspense>}
    <div hidden={sharing || sos}>
    {account.open && <Suspense fallback={<p role="status">Opening your collection…</p>}><Account/></Suspense>}
    <div hidden={account.open}>
    {planning && <Suspense fallback={<p role="status">Opening your trip postcard…</p>}><TripPlanner onClose={() => setPlanning(false)}/></Suspense>}
    {venues && <Suspense fallback={<p role="status">Loading entertainment venues…</p>}><Venues onClose={() => setVenues(false)}/></Suspense>}
    {events && <Suspense fallback={<p role="status">Loading community events…</p>}><Events onClose={() => setEvents(false)}/></Suspense>}
    {calendar && <Suspense fallback={<p role="status">Unfolding the calendar…</p>}><SpecialDays onClose={() => setCalendar(false)} onExplore={() => { setCalendar(false); setExploring(true); }}/></Suspense>}
    {safety && <Suspense fallback={<div className="safety-fallback"><a href="tel:112">Call 112</a><p>Loading safety tools. This app does not replace emergency services.</p></div>}><Safety onClose={() => setSafety(false)}/></Suspense>}
    {exploring && <Suspense fallback={<p role="status">Unfolding your next detour…</p>}><Explore onClose={() => setExploring(false)}/></Suspense>}
    <div hidden={exploring || safety || calendar || events || venues || planning || hub}>
    <header className="topbar"><a className="brand" href="/"><img className="brand-icon" src="/icons/spotland.svg" alt=""/>{APP_NAME}</a><button className="theme" onClick={() => setDark(!dark)} aria-pressed={dark}>{dark ? 'Light mode ☀' : 'Dark mode ☾'}</button></header>
    <div id="main" className="home-content">
      <section className="hero" aria-labelledby="hero-title">
        <div className="intro"><Sticker>LESS SCROLL. MORE STROLL.</Sticker><h1 id="hero-title">Your next<br/>“chalo?”<br/><em>starts here.</em></h1><p>Big plans? Optional.<br/>A good little adventure? Always.</p><button className="button" onClick={() => { history.pushState(null, '', '/features'); setHub(true); }}>Find your vibe <span aria-hidden="true">↗</span></button><span className="hand-note">a little detour looks good on you</span></div>
        <div className="postcard" role="img" aria-label="Illustrated Indian landscape with mountains, a rising sun, and a winding path"><div className="postcard-top">POSTCARD No. 001 <span>भारत / INDIA</span></div><div className="landscape"><div className="sun"/><div className="mountain back"/><div className="mountain front"/><div className="path"/><span className="landscape-caption">somewhere good.</span></div><div className="postcard-bottom"><span>TO: YOUR WEEKEND</span><span className="stamp">GO<br/>LOCAL</span></div><Sticker tone="lilac" floating>take the scenic route ↝</Sticker></div>
      </section>
    </div>
    </div>
    <section className="feature-hub" hidden={!hub} aria-labelledby="hub-title"><header className="topbar"><button className="back-home" onClick={() => { history.pushState(null, '', '/'); setHub(false); }}>← Home</button><strong>{APP_NAME}</strong><button className="theme" onClick={() => setDark(!dark)} aria-pressed={dark}>{dark ? 'Light mode ☀' : 'Dark mode ☾'}</button></header><div className="hub-content"><span className="eyebrow"><span className="tiny-dot"/> PICK A DETOUR</span><h1 id="hub-title">Where to?</h1><p>Everything you need, one tap away.</p><nav className="quick-actions" aria-label="SPOTLAND features" onClick={() => history.replaceState(null, '', '/')}><button className="button" onClick={() => { setHub(false); setExploring(true); }}>Explore nearby ↗</button><button className="calendar-entry" onClick={() => { setHub(false); setPlanning(true); }}>Plan a trip ↗</button><button className="calendar-entry" onClick={() => { setHub(false); account.setOpen(true); }}>Account &amp; favorites ♡</button><button className="calendar-entry" onClick={() => { setHub(false); setVenues(true); }}>Entertainment venues ↗</button><button className="calendar-entry" onClick={() => { setHub(false); setCalendar(true); }}>Festivals &amp; holidays ✳</button><button className="calendar-entry" onClick={() => { setHub(false); setEvents(true); }}>Community events ↗</button><button className="safety-entry" onClick={() => { setHub(false); setSafety(true); }}>Safety &amp; emergency numbers</button><button className="safety-entry" onClick={() => { setHub(false); setRecipientToken(undefined); setSharing(true); }}>Share live location</button><button className="safety-entry emergency-entry" onClick={() => { setHub(false); setSharing(false); setSos(true); }}>SOS emergency help</button></nav><p className="hub-status" role="status">Places service: {status} · {online ? 'Online' : 'Offline — open saved places'}</p></div></section>
    <footer><span>{APP_NAME} · Made for the way you wander.</span><a href="/privacy.html">Privacy</a><a href="/attributions.html">Attributions</a></footer>
    <LocalUsage screen={sos || sharing || safety || account.open ? null : planning ? 'trips' : venues ? 'venues' : events ? 'events' : calendar ? 'calendar' : exploring ? 'explore' : 'home'}/>

    <details id="credits"><summary>Design credits & licenses</summary><p>Landscape illustration created for this project. Fraunces, DM Sans, and Caveat are self-hosted Latin subsets under the SIL Open Font License; license files ship with the app. The home demo uses no external place data; Explore uses OpenStreetMap.</p></details>
    </div>
    </div>
    </main>
  </>;
}







