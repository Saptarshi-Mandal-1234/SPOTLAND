import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { HangoutCards, PassportStamp, SpotBadge, type MarkerOrigin } from './PlayfulExtras';
import { lightHaptic } from './playful';
import { categories, categoryLabel, distanceKm, knownOpen, type Category, type Place, type SearchResult } from '../../shared/places';
import { getNearby, searchLocation } from './explore-api';
import states from './states.json';
import type { Route } from '../../shared/routes';
import Directions from './Directions';
import Crowd from './Crowd';
import FavoriteButton from './FavoriteButton';
const Reviews = lazy(() => import('./Reviews'));
import { matchState, paletteFor } from './state-palettes';
import { readArea, saveArea } from './offline';
import { useOnline } from './useOnline';
const MapCanvas = lazy(() => import('./MapCanvas'));
const Weather = lazy(() => import('./Weather'));
const initialCenter = { lat: 28.6139, lon: 77.2090 };
export default function Explore({ onClose }: { onClose: () => void }) {
  const [remembered] = useState(readArea); const online = useOnline();
  const [center, setCenter] = useState(remembered?.center ?? initialCenter); const [mapCenter, setMapCenter] = useState(remembered?.center ?? initialCenter);
  const [destination, setDestination] = useState<Place | null>(null); const [route, setRoute] = useState<Route | null>(null);
  const [weatherPlace, setWeatherPlace] = useState<Place | null>(null);
  const mapRegion = useRef<HTMLDivElement>(null);
  const storageGeneration = useRef(0);
  const [radius, setRadius] = useState(remembered?.radius ?? 2000); const [category, setCategory] = useState<Category | ''>('');
  const [openOnly, setOpenOnly] = useState(false); const [rating, setRating] = useState(0);
  const [places, setPlaces] = useState<Place[]>([]); const [selected, setSelected] = useState<Place | null>(null);
  const [markerOrigin, setMarkerOrigin] = useState<MarkerOrigin | null>(null), [haptics, setHaptics] = useState(false), [stamp, setStamp] = useState('');
  const stamped = useRef(new Set<string>()), trigger = useRef<HTMLElement | null>(null);
  const selectPlace = (place: Place, origin?: MarkerOrigin) => { trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setMarkerOrigin(origin || null); setSelected(place); lightHaptic(haptics); };
  const closePlace = () => { setSelected(null); trigger.current?.focus(); };
  const stampState = (name: string) => { if (!name) return; setStamp(name); if (!stamped.current.has(name)) { stamped.current.add(name); lightHaptic(haptics); } };
  const [query, setQuery] = useState(''); const [results, setResults] = useState<SearchResult[]>([]);
  const [message, setMessage] = useState(''); const [loading, setLoading] = useState(false); const [searching, setSearching] = useState(false);
  const [region, setRegion] = useState(remembered?.region ?? 'Delhi'); const [reload, setReload] = useState(0); const [locating, setLocating] = useState(false);
  const searchAbort = useRef<AbortController | null>(null); const lastSearch = useRef(0); const closeButton = useRef<HTMLButtonElement>(null); const reduced = useReducedMotion();
  const state = states.find(item => item.name === region) || states.find(item => item.name === 'Delhi')!;
  const palette = paletteFor(state.name);
  useEffect(() => {
    const controller = new AbortController(); const storageRun = storageGeneration.current; let active = true; setLoading(true); setMessage('Finding little detours…'); setSelected(null); setPlaces([]);
    const fallback = (reason = 'Offline.') => { const snapshot = readArea(); if (snapshot && distanceKm(center, snapshot.center) < 1 && radius === snapshot.radius) { setPlaces(snapshot.places); setMessage(`${reason} Saved area from ${new Date(snapshot.savedAt).toLocaleString('en-IN')}. Details may be stale; street tiles need a connection.`); } else setMessage(reason + ' No saved places for this area. Reconnect to load it.'); };
    if (!online) { fallback(); setLoading(false); return () => { active = false; controller.abort(); }; }
    const slow = window.setTimeout(() => { if (active && storageRun === storageGeneration.current) setMessage('The map elves are taking a moment. Public data can be slow.'); }, 6000);
    getNearby(center.lat, center.lon, radius, controller.signal).then(data => { if (active && storageRun === storageGeneration.current) { setPlaces(data); const stored = saveArea(center, radius, data, region); setMessage((data.length ? 'Places from OpenStreetMap. Details may be incomplete.' : 'No named places here yet. Try a wider radius or another area.') + (stored ? ' This area’s place list is available offline.' : ' Offline storage is unavailable.')); } }).catch(error => { if (active && storageRun === storageGeneration.current) fallback(error instanceof Error ? error.message : 'Could not load places.'); }).finally(() => { window.clearTimeout(slow); if (active) setLoading(false); });
    return () => { active = false; controller.abort(); window.clearTimeout(slow); };
  }, [center, radius, reload, online]);
  useEffect(() => { const cleared = () => { ++storageGeneration.current; setLoading(false); setPlaces([]); setSelected(null); setMessage('Offline copies cleared. Refresh online to load places again.'); }; window.addEventListener('spotland-offline-cleared', cleared); return () => window.removeEventListener('spotland-offline-cleared', cleared); }, []);
  useEffect(() => () => searchAbort.current?.abort(), []);
  useEffect(() => { if (selected) closeButton.current?.focus(); }, [selected]);
  const move = useCallback((point: { lat: number; lon: number }) => setMapCenter(point), []);
  const choose = (point: SearchResult) => { setCenter({ lat: point.lat, lon: point.lon }); setMapCenter({ lat: point.lat, lon: point.lon }); setResults([]); const match = matchState(states, point.state); if (match) { setRegion(match.name); stampState(match.name); } };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (query.trim().length < 2 || searching || Date.now() - lastSearch.current < 1500) return;
    lastSearch.current = Date.now(); searchAbort.current?.abort(); const controller = new AbortController(); searchAbort.current = controller;
    setSearching(true); setResults([]);
    try { const data = await searchLocation(query.trim(), controller.signal); setResults(data); if (!data.length) setMessage('No matching location. Try a city or landmark in India.'); }
    catch (error) { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'Search unavailable.'); }
    finally { if (!controller.signal.aborted) setSearching(false); }
  };
  const locate = () => {
    if (!navigator.geolocation) { setMessage('Location is unavailable. Search for a city instead.'); return; }
    setLocating(true); setMessage('Waiting for location permission…');
    navigator.geolocation.getCurrentPosition(position => {
      setLocating(false); const point = { lat: position.coords.latitude, lon: position.coords.longitude };
      if (point.lat < 6 || point.lat > 38 || point.lon < 68 || point.lon > 98) { setMessage('This first version supports places in India. Search an Indian city.'); return; }
      setCenter(point); setMapCenter(point); setRegion('');
    }, error => { setLocating(false); setMessage(error.code === 1 ? 'Location permission declined. Search works without it.' : 'Could not find your location. Search for a city instead.'); }, { timeout: 15000, maximumAge: 60000, enableHighAccuracy: false });
  };
  const visible = places.filter(place => (!category || place.category === category) && distanceKm(center, place) <= radius / 1000 && (!openOnly || knownOpen(place)) && (!rating || (place.rating ?? 0) >= rating)).sort((a, b) => distanceKm(center, a) - distanceKm(center, b));
  return <section className="explore" aria-label="Explore nearby places" style={{ '--state-accent': palette.accent, '--state-light': palette.light, '--state-dark': palette.dark, '--state-highlight': palette.highlight, '--state-image': 'url(' + state.image + ')'  } as React.CSSProperties}>
    <header className="explore-header"><button onClick={onClose}>← Home</button><strong>Little detours</strong><a href="/attributions.html">Credits</a></header>
    <div className="explore-controls">
      <form onSubmit={submit} className="place-search"><label className="sr-only" htmlFor="place-search">Search a city or landmark in India</label><input id="place-search" value={query} maxLength={120} onChange={event => setQuery(event.target.value)} placeholder="City, landmark… chalo?"/><button disabled={searching || query.trim().length < 2}>{searching ? 'Searching…' : 'Search'}</button></form>
      {results.length > 0 && <ul className="search-results">{results.map((point, index) => <li key={index}><button onClick={() => choose(point)}>{point.name}</button></li>)}</ul>}
      <p className="location-note">“Use my location” sends a rounded area to our API and Overpass. Map tiles go to OpenStreetMap. The last browsing area is remembered on this device at coarse precision for seven days. No location is saved to your profile.</p>
      <div className="filter-row"><button onClick={locate} disabled={locating}>{locating ? 'Locating…' : 'Use my location'}</button><label>Distance<select value={radius} onChange={event => setRadius(Number(event.target.value))}><option value={1000}>1 km</option><option value={2000}>2 km</option><option value={5000}>5 km</option></select></label><label>Category<select value={category} onChange={event => setCategory(event.target.value as Category | '')}><option value="">All places</option>{categories.map(item => <option key={item} value={item}>{categoryLabel(item)}</option>)}</select></label><label className="open-filter"><input type="checkbox" checked={openOnly} onChange={event => setOpenOnly(event.target.checked)}/> Open now (verified 24/7 only)</label><label>Rating<select disabled={!places.some(place => place.rating !== undefined)} value={rating} onChange={event => setRating(Number(event.target.value))}><option value={0}>Not available from OSM</option><option value={4}>4+ stars</option></select></label></div>
      <p role="status" className="places-status">{message} {!loading && <button onClick={() => setReload(value => value + 1)}>Retry / refresh</button>}</p>
    </div>
    <div className="playful-controls"><label><input type="checkbox" checked={haptics} disabled={typeof navigator.vibrate !== 'function'} onChange={event => setHaptics(event.target.checked)}/> Light tap feedback (optional)</label><small>Supported browsers only; off with reduced motion. Preference lasts this visit.</small>{stamp && <PassportStamp name={stamp}/>}</div>
    <div ref={mapRegion} className="map-area"><Suspense fallback={<p className="map-loading">Unfolding your map…</p>}><MapCanvas center={center} places={visible} route={route} onSelect={selectPlace} onMove={move}/></Suspense><button className="search-area" disabled={loading || distanceKm(center, mapCenter) < .1} onClick={() => { setCenter(mapCenter); setRegion(''); }}>Search this area</button></div>
    <p className="map-attribution">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a> · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">Report a map issue</a></p>
    {!loading && visible.length > 0 && <HangoutCards key={`${center.lat}:${center.lon}:${radius}:${category}:${openOnly}:${rating}`} places={visible} onSelect={selectPlace} haptics={haptics}/>}
    {destination && <Directions key={destination.id} destination={destination} area={center} onRoute={setRoute} onShowMap={() => mapRegion.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' })} onClose={() => { setDestination(null); setRoute(null); }}/>}
    {weatherPlace && <Suspense fallback={<p role="status">Unfolding the forecast…</p>}><Weather key={weatherPlace.id} place={weatherPlace} onClose={() => setWeatherPlace(null)}/></Suspense>}
    <div className="explore-bottom"><aside className="state-card"><img key={state.name} src={state.image} loading="lazy" alt={`Stylised illustration of ${state.landmark}`}/><div><label htmlFor="state-select">Your postcard backdrop</label><select id="state-select" value={region} onChange={event => { setRegion(event.target.value); stampState(event.target.value); }}><option value="">Choose state / UT</option>{states.map(item => <option key={item.name}>{item.name}</option>)}</select><p>{state.landmark} · illustration</p><p className="palette-note">{palette.inspiration}</p><small>Backdrop selection doesn't move the map.</small></div></aside><div className="places-list"><h2>{visible.length} nearby detours</h2>{!loading && !visible.length && <p>Nothing matches these filters. Try “All places” or a wider radius.</p>}<ul>{visible.map(place => <li key={place.id}><button onClick={() => selectPlace(place)}><strong>{place.name}</strong><span>{categoryLabel(place.category)} · {distanceKm(center, place).toFixed(1)} km ↗</span></button></li>)}</ul></div></div>
    {selected && <motion.aside style={{ x: '-50%' }} className="place-sheet" aria-label="Place details" initial={reduced ? false : { y: markerOrigin ? 0 : 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', damping: 26, stiffness: 300 }} onKeyDown={event => { if (event.key === 'Escape') closePlace(); }}><button ref={closeButton} className="sheet-close" onClick={closePlace}>Close ✕</button><span className="eyebrow">{categoryLabel(selected.category)} · {distanceKm(center, selected).toFixed(1)} km</span><SpotBadge key={`badge:${selected.id}`} place={selected} origin={markerOrigin}/><h2>{selected.name}</h2><p>{selected.address}</p><p><strong>Opening hours:</strong> {selected.hours}</p><p className="location-note">{selected.category === 'gaming' && 'Arcades, escape games and internet cafes; confirm available games with the venue. '}OSM hours may be out of date. Confirm with the venue before going.</p><FavoriteButton key={`favorite:${selected.id}`} place={{ id: selected.id, name: selected.name, category: selected.category, address: selected.address, hours: selected.hours, lat: selected.lat, lon: selected.lon, sourceUrl: `https://www.openstreetmap.org/${selected.id}` }}/><Suspense fallback={<p role="status">Opening traveller notes…</p>}><Reviews key={`reviews:${selected.id}`} placeId={selected.id}/></Suspense><Crowd key={selected.id} placeId={selected.id}/><button onClick={() => { setDestination(selected); setRoute(null); setSelected(null); }}>Directions ↗</button><button onClick={() => { setWeatherPlace(selected); setSelected(null); }}>Weather &amp; best time ☀</button><a href={`https://www.openstreetmap.org/${selected.id}`} target="_blank" rel="noreferrer">View source on OpenStreetMap ↗</a></motion.aside>}
    <details id="explore-credits"><summary>Map, data & illustration attributions</summary><p>Map tiles, place data, and submitted location searches: OpenStreetMap contributors, ODbL. Public Nominatim geocoding is used only on explicit search, cached for a day, and limited across users. Overpass queries are cached for 30 minutes. No ratings are invented. Open-now filtering includes only explicit 24/7 schedules.</p><p>State landmark illustrations: original SPOTLAND artwork, CC0. Full source and license metadata: <a href="/states.json">states.json</a>. Offline map downloads are unavailable with the current public tile provider.</p></details>
  </section>;
}
















