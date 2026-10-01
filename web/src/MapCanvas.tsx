import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { categoryLabel, type Place } from '../../shared/places';
import { getMapConfig } from './explore-api';
import type { Route } from '../../shared/routes';
import { useOnline } from './useOnline';
import type { MarkerOrigin } from './PlayfulExtras';
interface Props { center: { lat: number; lon: number }; places: Place[]; route?: Route | null; plain?: boolean; onSelect: (place: Place, origin?: MarkerOrigin) => void; onMove: (center: { lat: number; lon: number }) => void }
const symbols = { cafe: 'C', restaurant: 'R', attraction: 'A', park: 'P', museum: 'M', temple: 'T', viewpoint: 'V', shopping: 'S', gaming: 'G', police: 'P', hospital: 'H', pharmacy: '+', clinic: '+', doctors: '+', fire_station: 'F' };
maplibregl.setWorkerUrl(mapWorkerUrl);
export default function MapCanvas({ center, places, route, plain = false, onSelect, onMove }: Props) {
  const online = useOnline();
  const [attempt, setAttempt] = useState(0);
  const container = useRef<HTMLDivElement>(null); const map = useRef<maplibregl.Map | null>(null);
  const [error, setError] = useState(''); const callbacks = useRef({ onSelect, onMove, center });
  useEffect(() => { callbacks.current = { onSelect, onMove, center }; }, [onSelect, onMove, center]);
  useEffect(() => {
    const controller = new AbortController(); let disposed = false;
    setError(online ? '' : 'Offline: place markers only. Street tiles need a connection.');
    (online ? getMapConfig(controller.signal).catch(() => { if (!disposed) setError('Street map unavailable. Showing place markers without street tiles.'); return null; }) : Promise.resolve(null)).then(config => {
      if (disposed || !container.current) return;
      const latestCenter = callbacks.current.center;
      const instance = new maplibregl.Map({ container: container.current, center: [latestCenter.lon, latestCenter.lat], zoom: 13, attributionControl: false, style: config ? { version: 8, sources: { osm: { type: 'raster', tiles: [config.tileUrl], tileSize: 256, maxzoom: 19 } }, layers: [{ id: 'base', type: 'raster', source: 'osm' }] } : { version: 8, sources: {}, layers: [{ id: 'offline-background', type: 'background', paint: { 'background-color': '#f6f1e4' } }] } });
      map.current = instance;
      instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      instance.on('moveend', () => { const point = instance.getCenter(); callbacks.current.onMove({ lat: point.lat, lon: point.lng }); });
      instance.on('error', () => setError('Map tiles could not load. The places list still works.'));
    }).catch(() => { if (!disposed) setError('Map unavailable. Retry by reopening Explore; the places list still works.'); });
    return () => { disposed = true; controller.abort(); map.current?.remove(); map.current = null; };
  }, [online, attempt]);
  useEffect(() => { map.current?.easeTo({ center: [center.lon, center.lat], duration: plain || matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 400 }); }, [center, plain]);
  useEffect(() => {
    let disposed = false; const markers: maplibregl.Marker[] = [];
    const add = () => {
      if (disposed || !map.current) return;
      for (const place of places) {
        const button = document.createElement('button'); button.className = `place-marker marker-${place.category}`;
        const doodle = document.createElement('span'); doodle.className = 'marker-doodle'; doodle.textContent = symbols[place.category]; doodle.setAttribute('aria-hidden', 'true'); button.append(doodle);
        button.setAttribute('aria-label', `${categoryLabel(place.category)}: ${place.name}`); button.addEventListener('click', () => { const rect = button.getBoundingClientRect(); callbacks.current.onSelect(place, { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }); });
        markers.push(new maplibregl.Marker({ element: button }).setLngLat([place.lon, place.lat]).addTo(map.current));
      }
    };
    // Configuration loads asynchronously, so wait for the map initialization event.
    const timer = window.setInterval(() => { if (map.current) { window.clearInterval(timer); add(); } }, 100);
    return () => { disposed = true; window.clearInterval(timer); markers.forEach(marker => marker.remove()); };
  }, [places, online, attempt]);
  useEffect(() => {
    const draw = () => {
      const instance = map.current; if (!instance || !instance.isStyleLoaded()) return false;
      if (instance.getLayer('route-line')) instance.removeLayer('route-line');
      if (instance.getSource('route')) instance.removeSource('route');
      if (route) {
        instance.addSource('route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: route.geometry } });
        instance.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#b73522', 'line-width': 6, 'line-opacity': .9 } });
        const bounds = new maplibregl.LngLatBounds(); for (const point of route.geometry.coordinates) bounds.extend(point);
        instance.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 400 });
      }
      return true;
    };
    if (draw()) return;
    const timer = window.setInterval(() => { if (draw()) window.clearInterval(timer); }, 100);
    return () => window.clearInterval(timer);
  }, [route, online, attempt]);
  return <><div ref={container} className="map-canvas" aria-label="Map of nearby places"/>{error && <p role="status" className="map-error">{error} {online && <button onClick={() => setAttempt(value => value + 1)}>Retry street map</button>}</p>}</>;
}

