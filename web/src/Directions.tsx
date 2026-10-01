import { useEffect, useRef, useState } from 'react';
import { formatDistance, formatDuration, googleMapsLink, travelModes, type Point, type Route, type TravelMode } from '../../shared/routes';
import type { Place, SearchResult } from '../../shared/places';
import { searchLocation } from './explore-api';
import { fetchRoute } from './route-api';
export default function Directions({ destination, area, onRoute, onClose, onShowMap }: { destination: Place; area: Point; onRoute: (route: Route | null) => void; onClose: () => void; onShowMap: () => void }) {
  const [start, setStart] = useState<Point>(area); const [startName, setStartName] = useState('Selected exploration area'); const [mode, setMode] = useState<TravelMode>('walk');
  const [route, setRoute] = useState<Route | null>(null); const [message, setMessage] = useState('Choose a start and mode, then get directions.'); const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState(''); const [results, setResults] = useState<SearchResult[]>([]); const [searching, setSearching] = useState(false);
  const active = useRef<AbortController | null>(null); const searchAbort = useRef<AbortController | null>(null); const mounted = useRef(true); const locating = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; active.current?.abort(); searchAbort.current?.abort(); }; }, []);
  function clear() { active.current?.abort(); setBusy(false); setRoute(null); onRoute(null); setMessage('Start or mode changed. Get directions to update the route.'); }
  function choose(point: Point, name: string) { clear(); setStart(point); setStartName(name); setResults([]); }
  async function load() {
    active.current?.abort(); const controller = new AbortController(); active.current = controller; setBusy(true); setRoute(null); onRoute(null); setMessage('Finding your way…');
    try { const data = await fetchRoute(start, destination, mode, controller.signal); if (!controller.signal.aborted) { setRoute(data); onRoute(data); setMessage('Route ready. Times are estimates; check local access and signs.'); } }
    catch (error) { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'Route unavailable.'); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  async function search(event: React.FormEvent) {
    event.preventDefault(); if (searching || query.trim().length < 2) return;
    searchAbort.current?.abort(); const controller = new AbortController(); searchAbort.current = controller; setSearching(true); setResults([]);
    try { const data = await searchLocation(query.trim(), controller.signal); if (!controller.signal.aborted) { setResults(data); if (!data.length) setMessage('No start found. Try a nearby landmark.'); } }
    catch (error) { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'Search unavailable.'); }
    finally { if (!controller.signal.aborted) setSearching(false); }
  }
  function locate() {
    if (!navigator.geolocation) { setMessage('Location unavailable. Choose a start using search.'); return; }
    if (locating.current) return; locating.current = true; setMessage('Waiting for location permission…');
    navigator.geolocation.getCurrentPosition(position => { locating.current = false; if (mounted.current) choose({ lat: position.coords.latitude, lon: position.coords.longitude }, 'My current location'); }, () => { locating.current = false; if (mounted.current) setMessage('Could not use your location. Choose a start using search.'); }, { timeout: 15000, maximumAge: 60000, enableHighAccuracy: false });
  }
  return <section className="directions-panel" aria-label="Directions">
    <div className="directions-title"><h2 ref={heading} tabIndex={-1}>To {destination.name}</h2><button onClick={onClose}>Close directions ✕</button></div>
    <p><strong>Start:</strong> {startName} ({start.lat.toFixed(3)}, {start.lon.toFixed(3)})</p><div className="route-actions"><button onClick={locate}>Use current location</button><button onClick={() => choose(area, 'Selected exploration area')}>Use exploration area</button></div>
    <form className="place-search" onSubmit={search}><label className="sr-only" htmlFor="route-start">Search route start</label><input id="route-start" maxLength={120} value={query} onChange={event => setQuery(event.target.value)} placeholder="Choose another start…"/><button disabled={searching || query.trim().length < 2}>{searching ? 'Searching…' : 'Find start'}</button></form>
    {results.length > 0 && <ul className="search-results">{results.map((result, index) => <li key={index}><button onClick={() => choose(result, result.name)}>{result.name}</button></li>)}</ul>}
    <div className="route-actions" role="group" aria-label="Travel mode">{travelModes.map(value => <button key={value} aria-pressed={value === mode} onClick={() => { if (value !== mode) { clear(); setMode(value); } }}>{value === 'walk' ? 'Walk' : value === 'drive' ? 'Drive' : 'Cycle'}</button>)}<button disabled={busy} onClick={load}>{busy ? 'Routing…' : 'Get directions'}</button></div>
    <p className="location-note">On request, rounded start and destination coordinates go to our API and the FOSSGIS routing service. Routes are cached for 10 minutes. No background tracking.</p><p role="status">{message}</p>
    <a href={googleMapsLink(destination, mode, start)} target="_blank" rel="noreferrer">Open in Google Maps ↗</a>
    {route && <><p className="route-summary"><strong>{formatDistance(route.distance)}</strong> · {formatDuration(route.duration)} · {mode}</p><button onClick={onShowMap}>View route on map ↑</button><ol className="route-steps">{route.steps.map((step, index) => <li key={index}>{step.instruction} <span>{formatDistance(step.distance)}</span></li>)}</ol><p className="location-note">Rounded locations may shift the start/end by about 100 m. Route data may not reflect closures, accessibility, or live traffic.</p></>}
    <p className="location-note">Routing: <a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noreferrer">FOSSGIS / OSRM</a> · © OpenStreetMap contributors.</p>
  </section>;
}
