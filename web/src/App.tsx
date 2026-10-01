import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { APP_NAME } from './config';
import { checkHealth } from './api';
import { Sticker } from './design';
import { useAccount } from './AccountContext';
import OfflineStatus from './OfflineStatus';
import { useOnline } from './useOnline';
import LocalUsage from './LocalUsage';

const moods = ['Slow scenes', 'Food first', 'Little adventure'];
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
  const [dark, setDark] = useState(() => { try { return localStorage.getItem('theme') === 'dark'; } catch { return false; } });
  const [mood, setMood] = useState(moods[0]);
  const [status, setStatus] = useState('Checking…');
  const online = useOnline();
  const content = useRef<HTMLElement>(null);
  const screenKey = [sos,sharing,planning,venues,safety,calendar,events,exploring,account.open].join(':');
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
    <OfflineStatus/>
    {account.open && <Suspense fallback={<p role="status">Opening your collection…</p>}><Account/></Suspense>}
    <div hidden={account.open}>
    {planning && <Suspense fallback={<p role="status">Opening your trip postcard…</p>}><TripPlanner onClose={() => setPlanning(false)}/></Suspense>}
    {venues && <Suspense fallback={<p role="status">Loading entertainment venues…</p>}><Venues onClose={() => setVenues(false)}/></Suspense>}
    {events && <Suspense fallback={<p role="status">Loading community events…</p>}><Events onClose={() => setEvents(false)}/></Suspense>}
    {calendar && <Suspense fallback={<p role="status">Unfolding the calendar…</p>}><SpecialDays onClose={() => setCalendar(false)} onExplore={() => { setCalendar(false); setExploring(true); }}/></Suspense>}
    {safety && <Suspense fallback={<div className="safety-fallback"><a href="tel:112">Call 112</a><p>Loading safety tools. This app does not replace emergency services.</p></div>}><Safety onClose={() => setSafety(false)}/></Suspense>}
    {exploring && <Suspense fallback={<p role="status">Unfolding your next detour…</p>}><Explore onClose={() => setExploring(false)}/></Suspense>}
    <div hidden={exploring || safety || calendar || events || venues || planning}>
    <header className="topbar"><a className="brand" href="/"><img className="brand-icon" src="/icons/spotland.svg" alt=""/>{APP_NAME}</a><button className="theme" onClick={() => setDark(!dark)} aria-pressed={dark}>{dark ? 'Light mode ☀' : 'Dark mode ☾'}</button></header>
    <div id="main" className="home-content"><button className="calendar-entry" onClick={() => setPlanning(true)}>Plan a trip ↗</button><button className="safety-entry" onClick={() => { setSharing(false); setSos(true); }}>SOS emergency help</button><button className="safety-entry" onClick={() => { setRecipientToken(undefined); setSharing(true); }}>Share live location</button><button className="calendar-entry" onClick={() => account.setOpen(true)}>Account &amp; favorites ♡</button><button className="calendar-entry" onClick={() => setVenues(true)}>Entertainment venues ↗</button><button className="safety-entry" onClick={() => setSafety(true)}>Safety & emergency numbers</button><button className="button" onClick={() => setExploring(true)}>Explore nearby ↗</button><button className="calendar-entry" onClick={() => setCalendar(true)}>Festivals & holidays ✳</button><button className="calendar-entry" onClick={() => setEvents(true)}>Community events ↗</button>
      <div className="eyebrow"><span className="tiny-dot"/> INDIA FIRST. WANDER ALWAYS.</div>
      <section className="hero" aria-labelledby="hero-title">
        <div className="intro"><Sticker>LESS SCROLL. MORE STROLL.</Sticker><h1 id="hero-title">Your next<br/>“chalo?”<br/><em>starts here.</em></h1><p>Big plans? Optional.<br/>A good little adventure? Always.</p><a className="button" href="#demo">Find your vibe <span aria-hidden="true">↗</span></a><span className="hand-note">a little detour looks good on you</span></div>
        <div className="postcard" role="img" aria-label="Illustrated Indian landscape with mountains, a rising sun, and a winding path"><div className="postcard-top">POSTCARD No. 001 <span>भारत / INDIA</span></div><div className="landscape"><div className="sun"/><div className="mountain back"/><div className="mountain front"/><div className="path"/><span className="landscape-caption">somewhere good.</span></div><div className="postcard-bottom"><span>TO: YOUR WEEKEND</span><span className="stamp">GO<br/>LOCAL</span></div><Sticker tone="lilac" floating>take the scenic route ↝</Sticker></div>
      </section>
      <section className="demo" id="demo" aria-labelledby="demo-title"><div className="section-heading"><div><span className="eyebrow">THE STARTER PACK</span><h2 id="demo-title">What's your vibe?</h2></div><span className="hand-note">no wrong answers ↙</span></div><p className="demo-note">Mood picker preview · Explore nearby for live places.</p><div className="moods">{moods.map((item, index) => <button key={item} className={`mood mood-${index}`} aria-pressed={mood === item} onClick={() => setMood(item)}><span className="mood-number">0{index + 1}</span><strong>{item}</strong><span>{['Chai, shade & a softer pace.', 'Follow your appetite.', 'Take a turn. Find a story.'][index]}</span><span className="mood-selected">{mood === item ? 'Your current vibe ✓' : 'Pick this vibe ↗'}</span></button>)}</div></section>
      <section className="status-bar" aria-label="Connection status"><span><span className="tiny-dot"/> READY FOR A DETOUR</span><span role="status">Places service: {status} · {online ? 'Online' : 'Offline — open saved places'}</span></section>
    </div>
    <footer><span>{APP_NAME} · Made for the way you wander.</span><a href="/privacy.html">Privacy</a><a href="/attributions.html">Attributions</a></footer>
    <LocalUsage screen={sos || sharing || safety || account.open ? null : planning ? 'trips' : venues ? 'venues' : events ? 'events' : calendar ? 'calendar' : exploring ? 'explore' : 'home'}/>

    <details id="credits"><summary>Design credits & licenses</summary><p>Landscape illustration created for this project. Fraunces, DM Sans, and Caveat are self-hosted Latin subsets under the SIL Open Font License; license files ship with the app. The home demo uses no external place data; Explore uses OpenStreetMap.</p></details>
    </div>
    </div>
    </div>
    </main>
  </>;
}







