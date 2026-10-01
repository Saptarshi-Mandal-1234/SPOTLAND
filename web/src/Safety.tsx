import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { distanceKm, safetyCategories, type Place, type SearchResult } from '../../shared/places';
import { parseSnapshot, type SafetySnapshot } from '../../shared/safety';
import { googleMapsLink } from '../../shared/routes';
import { emergencyNumbers, emergencyVerifiedOn } from './emergency';
import { API_BASE_URL } from './config';
import { searchLocation } from './explore-api';
const MapCanvas = lazy(() => import('./MapCanvas'));
const cacheKey = 'travelapp:safety:last-area:v1';
function cachedSnapshot() { try { return parseSnapshot(localStorage.getItem(cacheKey)); } catch { return null; } }
export default function Safety({ onClose }: { onClose: () => void }) {
  const [snapshot, setSnapshot] = useState<SafetySnapshot | null>(cachedSnapshot);
  const [center, setCenter] = useState(snapshot?.center || null); const [mapCenter, setMapCenter] = useState(center);
  const [reload, setReload] = useState(0); const [online, setOnline] = useState(navigator.onLine); const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(snapshot ? 'Showing the last saved area. Check its timestamp or refresh facilities.' : 'Choose your area to find emergency facilities. Emergency numbers above work without internet.');
  const [query, setQuery] = useState(''); const [results, setResults] = useState<SearchResult[]>([]); const [searching, setSearching] = useState(false);
  const [filter, setFilter] = useState(''); const [selected, setSelected] = useState<Place | null>(null);
  const searchAbort = useRef<AbortController | null>(null); const mounted = useRef(true); const locating = useRef(false);
  const detailClose = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    mounted.current = true; const update = () => setOnline(navigator.onLine); window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { mounted.current = false; searchAbort.current?.abort(); window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  useEffect(() => { if (selected) detailClose.current?.focus(); }, [selected]);
  useEffect(() => {
    if (!center || reload === 0) return;
    if (!navigator.onLine) { setBusy(false); setMessage('Offline. Showing the last saved area, if available. Numbers are available above.'); return; }
    const controller = new AbortController(); let active = true; setBusy(true); setSelected(null); setMessage('Loading emergency facilities. For urgent help, call 112 now.');
    async function load() {
      try {
        await Promise.resolve(); if (!active) return;
        const response = await fetch(`${API_BASE_URL}/safety?lat=${center!.lat.toFixed(3)}&lon=${center!.lon.toFixed(3)}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Emergency facilities unavailable.');
        if (!active) return;
        const saved = parseSnapshot(JSON.stringify({ center, places: data, savedAt: Date.now() })); if (!saved) throw new Error('Invalid facility response.');
        setSnapshot(saved); setMessage(saved.places.length ? 'Facilities loaded. OSM coverage and phone numbers may be incomplete.' : 'No mapped facilities in this area. This does not mean none exist. Call 112 for urgent help.');
        try { localStorage.setItem(cacheKey, JSON.stringify(saved)); } catch { setMessage('Facilities loaded, but this browser could not save them for offline use.'); }
      } catch (error) { if (active) setMessage(`${error instanceof Error ? error.message : 'Facilities unavailable.'} Last saved results remain labeled below. Call 112 for urgent help.`); }
      finally { if (active) setBusy(false); }
    }
    void load(); return () => { active = false; controller.abort(); };
  }, [center, reload]);
  const choose = (point: { lat: number; lon: number }) => { const area = { lat: Number(point.lat.toFixed(3)), lon: Number(point.lon.toFixed(3)) }; setCenter(area); setMapCenter(area); setResults([]); setReload(value => value + 1); };
  const onMove = useCallback((point: { lat: number; lon: number }) => setMapCenter(point), []);
  const locate = () => {
    if (!navigator.geolocation) { setMessage('Location unavailable. Search for your area instead.'); return; }
    if (locating.current) return; locating.current = true; setMessage('Waiting for location permission. Call 112 if you need urgent help.');
    navigator.geolocation.getCurrentPosition(position => { locating.current = false; if (mounted.current) choose({ lat: position.coords.latitude, lon: position.coords.longitude }); }, () => { locating.current = false; if (mounted.current) setMessage('Location unavailable or declined. Search for your area instead.'); }, { timeout: 15000, maximumAge: 60000, enableHighAccuracy: false });
  };
  async function search(event: React.FormEvent) {
    event.preventDefault(); if (searching || query.trim().length < 2) return; searchAbort.current?.abort(); const controller = new AbortController(); searchAbort.current = controller; setSearching(true); setResults([]);
    try { const data = await searchLocation(query.trim(), controller.signal); if (!controller.signal.aborted) { setResults(data); if (!data.length) setMessage('No area found. Try a city or landmark.'); } }
    catch (error) { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'Area search unavailable.'); }
    finally { if (!controller.signal.aborted) setSearching(false); }
  }
  const visible = (snapshot?.places || []).filter(place => (!filter || place.category === filter) && distanceKm(snapshot!.center, place) <= 5).sort((a, b) => distanceKm(snapshot!.center, a) - distanceKm(snapshot!.center, b));
  const showingOtherArea = Boolean(snapshot && center && distanceKm(snapshot.center, center) > .2);
  return <section className="safety" aria-label="Safety">
    <header className="safety-header"><button onClick={onClose}>← Home</button><h1>Safety</h1><a className="emergency-call" href="tel:112">Call 112</a></header>
    <div className="safety-content"><p><strong>This app does not replace emergency services.</strong> For urgent help in India, call 112. Map loading never blocks the emergency numbers.</p>
      <section aria-labelledby="numbers-title"><h2 id="numbers-title">Emergency numbers — available offline</h2><p>Calls require telephone service. Local availability of legacy numbers varies; 112 is the primary emergency option.</p><ul className="emergency-numbers">{emergencyNumbers.map(item => <li key={item.number}><a href={`tel:${item.number}`} aria-label={`Call ${item.number}: ${item.label}`}><strong>{item.number}</strong> {item.label}</a><p>{item.note}</p></li>)}</ul><details><summary>Number sources · checked {emergencyVerifiedOn}</summary><ul>{emergencyNumbers.map(item => <li key={item.number}><a href={item.source} target="_blank" rel="noreferrer">{item.number}: official source</a></li>)}</ul></details></section>
      <section aria-labelledby="facilities-title"><h2 id="facilities-title">Nearby emergency facilities</h2><p>Police, hospitals, pharmacies, clinics, doctors, and fire stations within 5 km of your chosen area. OSM coverage varies; missing results do not mean help is unavailable.</p><p className="location-note">Location is requested only when you press the button. A rounded area goes to our API and Overpass; tiles go to OpenStreetMap. Only the last facility area is saved on this device.</p>
        <button onClick={locate}>Use my location for safety</button><form onSubmit={search} className="place-search"><label htmlFor="safety-search" className="sr-only">Search safety area</label><input id="safety-search" value={query} maxLength={120} onChange={event => setQuery(event.target.value)} placeholder="Search city or landmark"/><button disabled={searching || !online || query.trim().length < 2}>{searching ? 'Searching…' : 'Find area'}</button></form>
        {results.length > 0 && <ul className="search-results">{results.map((point, index) => <li key={index}><button onClick={() => choose(point)}>{point.name}</button></li>)}</ul>}
        <p role="status">{!online && 'Offline. '}{message}</p>
        <label>Facility type <select value={filter} onChange={event => setFilter(event.target.value)}><option value="">All facilities</option>{safetyCategories.map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>
        {center && <button disabled={busy || !online} onClick={() => setReload(value => value + 1)}>Refresh facilities</button>}
        {snapshot && <p className="saved-area"><strong>{showingOtherArea ? 'Previous saved area — not the area you just selected.' : 'Saved facility results.'}</strong> Area: {snapshot.center.lat.toFixed(3)}, {snapshot.center.lon.toFixed(3)} · Saved {new Date(snapshot.savedAt).toLocaleString('en-IN')}. Details may have changed.</p>}
        {snapshot && online && <><div className="safety-map"><Suspense fallback={<p>Loading safety map. The list and numbers remain available.</p>}><MapCanvas center={snapshot.center} places={visible} plain onSelect={setSelected} onMove={onMove}/></Suspense></div><p>© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></p><button disabled={busy || !mapCenter} onClick={() => { if (mapCenter) choose(mapCenter); }}>Search displayed map area</button></>}
        {!online && <p>The tile provider does not support offline map downloads. Saved facility details remain available below.</p>}
        <h3>{visible.length} mapped facilities in the saved area</h3><ul className="facility-list">{visible.map(place => <li key={place.id}><h3>{place.name}</h3><p>{place.category.replaceAll('_', ' ')} · {distanceKm(snapshot!.center, place).toFixed(1)} km straight-line</p><p>{place.address}</p><p>{place.hours}</p><div className="facility-actions">{place.phone ? <a href={`tel:${place.phone}`}>Call {place.phone}</a> : <span>Phone not listed. For an emergency, <a href="tel:112">Call 112</a>.</span>}<a href={googleMapsLink(place, 'drive')} target="_blank" rel="noreferrer">Directions ↗</a></div></li>)}</ul>
        {snapshot && !visible.length && <p>No mapped facilities match this filter. Call 112 for urgent help.</p>}
        <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">Report a missing or incorrect place on OpenStreetMap ↗</a><p>Reporting updates map data; it does not request emergency assistance.</p>
      </section>
    </div>
    {selected && <aside className="safety-detail" aria-label="Safety place details" onKeyDown={event => { if (event.key === 'Escape') setSelected(null); }}><button ref={detailClose} onClick={() => setSelected(null)}>Close facility details</button><h2>{selected.name}</h2><p>{selected.category.replaceAll('_', ' ')} · {selected.address}</p><p>{selected.hours}</p>{selected.phone ? <a href={`tel:${selected.phone}`}>Call {selected.phone}</a> : <p>Phone not listed. For urgent help, <a href="tel:112">Call 112</a>.</p>}<a href={googleMapsLink(selected, 'drive')} target="_blank" rel="noreferrer">Directions ↗</a></aside>}
  </section>;
}
