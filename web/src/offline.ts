import { validateFavorite, type FavoriteRecord } from '../../shared/accounts';
import { categories, type Place } from '../../shared/places';
const prefix = 'spotland-offline-v1:';
const lifetime = 7 * 24 * 60 * 60 * 1000;
export interface AreaSnapshot { center: { lat: number; lon: number }; radius: number; region: string; places: Place[]; savedAt: number }
interface CollectionSnapshot { owner: string; rows: FavoriteRecord[]; savedAt: number }
function read(key: string): unknown {
  try { const raw = localStorage.getItem(prefix + key); return raw && raw.length <= 600000 ? JSON.parse(raw) : null; } catch { return null; }
}
function fresh(time: unknown): time is number { return typeof time === 'number' && Number.isFinite(time) && time <= Date.now() && time > Date.now() - lifetime; }
function discard(key: string) { try { localStorage.removeItem(prefix + key); } catch { /* Storage may be blocked. */ } }
function write(key: string, value: unknown): boolean {
  try { const raw = JSON.stringify(value); if (raw.length > 600000) return false; localStorage.setItem(prefix + key, raw); return true; } catch { return false; }
}
export function readCollection(): CollectionSnapshot | null {
  try {
    const value = read('favorites') as CollectionSnapshot | null;
    if (!value || typeof value.owner !== 'string' || !value.owner || value.owner.length > 200 || !fresh(value.savedAt) || !Array.isArray(value.rows) || value.rows.length > 200) { discard('favorites'); return null; }
    return { owner: value.owner, savedAt: value.savedAt, rows: value.rows.map(row => { if (typeof row.savedAt !== 'number' || !Number.isFinite(row.savedAt)) throw new Error('Invalid date'); return { savedAt: row.savedAt, place: validateFavorite(row.place) }; }) };
  } catch { discard('favorites'); return null; }
}
export function saveCollection(owner: string, rows: FavoriteRecord[]) {
  try { if (!owner || owner.length > 200 || rows.length > 200) return false; return write('favorites', { owner, rows: rows.map(row => { if (!Number.isFinite(row.savedAt) || row.savedAt < 0) throw new Error('Invalid date'); return { place: validateFavorite(row.place), savedAt: row.savedAt }; }), savedAt: Date.now() }); } catch { return false; }
}
export function clearCollection() { try { localStorage.removeItem(prefix + 'favorites'); return true; } catch { return false; } }
export function readArea(): AreaSnapshot | null {
  try {
    const value = read('area') as AreaSnapshot | null;
    if (!value || !fresh(value.savedAt) || typeof value.region !== 'string' || value.region.length > 100 || ![1000, 2000, 5000].includes(value.radius) || !Array.isArray(value.places) || value.places.length > 500) { discard('area'); return null; }
    if (!Number.isFinite(value.center.lat) || !Number.isFinite(value.center.lon) || value.center.lat < 6 || value.center.lat > 38 || value.center.lon < 68 || value.center.lon > 98) { discard('area'); return null; }
    const places = value.places.map(place => {
      const valid = validateFavorite(place);
      if (!categories.some(category => category === valid.category) || valid.lat === undefined || valid.lon === undefined) throw new Error('Invalid place');
      return { id: valid.id, name: valid.name, category: valid.category, address: valid.address, hours: valid.hours, lat: valid.lat, lon: valid.lon } as Place;
    });
    return { center: value.center, radius: value.radius, region: value.region, savedAt: value.savedAt, places };
  } catch { discard('area'); return null; }
}
export function saveArea(center: AreaSnapshot['center'], radius: number, places: Place[], region = '') {
  // Only a coarse public browsing area is remembered; live-share positions never enter this store.
  try { if (!Number.isFinite(center.lat) || !Number.isFinite(center.lon) || center.lat < 6 || center.lat > 38 || center.lon < 68 || center.lon > 98 || ![1000, 2000, 5000].includes(radius) || region.length > 100) return false; return write('area', { center: { lat: Math.round(center.lat * 100) / 100, lon: Math.round(center.lon * 100) / 100 }, radius, region, places: places.slice(0, 500).map(place => validateFavorite(place)), savedAt: Date.now() }); } catch { return false; }
}
export function clearOfflineData() {
  try { localStorage.removeItem(prefix + 'area'); localStorage.removeItem(prefix + 'favorites'); window.dispatchEvent(new Event('spotland-offline-cleared')); return true; } catch { return false; }
}
