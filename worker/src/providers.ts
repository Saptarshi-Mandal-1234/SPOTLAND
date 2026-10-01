import { safetyCategories, type Place, type SearchResult, type Category } from '../../shared/places';
import { normalizePhone } from '../../shared/safety';
import { readCache, reserveProvider, writeCache, type Database } from './db';
export interface ProviderEnv { DB?: Database; OVERPASS_URL?: string; NOMINATIM_URL?: string; PROVIDER_USER_AGENT?: string; TILE_URL?: string }
export class ProviderError extends Error { constructor(message: string, public status = 502) { super(message); } }
type Tags = Record<string, string>;
export function categoryFor(tags: Tags): Category | null {
  if (tags.shop === 'mall') return 'shopping';
  if (['amusement_arcade', 'escape_game'].includes(tags.leisure) || tags.amenity === 'internet_cafe') return 'gaming';
  if (tags.amenity === 'cafe') return 'cafe';
  if (tags.amenity === 'restaurant') return 'restaurant';
  if (tags.leisure === 'park') return 'park';
  if (tags.tourism === 'museum') return 'museum';
  if (tags.amenity === 'place_of_worship' && tags.religion === 'hindu') return 'temple';
  if (tags.tourism === 'viewpoint') return 'viewpoint';
  if (tags.tourism === 'attraction') return 'attraction';
  return null;
}
export function parsePlaces(data: unknown): Place[] {
  if (!data || typeof data !== 'object' || !('elements' in data) || !Array.isArray(data.elements)) throw new ProviderError('Unexpected places response');
  if ('remark' in data) throw new ProviderError('Places provider timed out. Try a smaller radius.');
  const places: Place[] = [];
  for (const raw of data.elements) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as { id: number; type: string; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Tags };
    const tags = item.tags || {}; const category = categoryFor(tags);
    const lat = item.lat ?? item.center?.lat; const lon = item.lon ?? item.center?.lon;
    if (!category || !tags.name || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    places.push({ id: `${item.type}/${item.id}`, name: tags.name, category, lat: lat!, lon: lon!, address: tags['addr:full'] || [tags['addr:housenumber'], tags['addr:street'], tags['addr:suburb'], tags['addr:city']].filter(Boolean).join(', ') || 'Address not listed', hours: tags.opening_hours || 'Hours not listed' });
  }
  return places.slice(0, 300);
}
export function parseSearch(data: unknown): SearchResult[] {
  if (!Array.isArray(data)) throw new ProviderError('Unexpected search response');
  return data.flatMap((row: { display_name?: string; lat?: string; lon?: string; address?: { state?: string } }) => {
    if (!row || typeof row.display_name !== 'string' || !row.lat || !row.lon || !Number.isFinite(Number(row.lat)) || !Number.isFinite(Number(row.lon))) return [];
    return [{ name: row.display_name, lat: Number(row.lat), lon: Number(row.lon), state: row.address?.state || '' }];
  });
}
async function cached(env: ProviderEnv, key: string, provider: string, interval: number, ttl: number, load: () => Promise<unknown>) {
  if (!env.DB) throw new ProviderError('Place search needs the configured D1 database.', 503);
  const hit = await readCache(env.DB, key); if (hit !== null) return hit;
  if (!await reserveProvider(env.DB, provider, interval)) throw new ProviderError('Provider is busy. Wait a few seconds and try again.', 429);
  const result = await load(); await writeCache(env.DB, key, result, ttl); return result;
}
async function json(url: string, env: ProviderEnv, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, headers: { 'User-Agent': env.PROVIDER_USER_AGENT || 'TravelApp/0.1 (local development)', ...init.headers }, signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new ProviderError('Place provider is temporarily unavailable.', response.status === 429 ? 429 : 502);
  return response.json();
}
export async function nearby(env: ProviderEnv, lat: number, lon: number, radius: number) {
  const roundedLat = Number(lat.toFixed(3)); const roundedLon = Number(lon.toFixed(3));
  const key = `nearby:v2:${env.OVERPASS_URL}:${roundedLat}:${roundedLon}:${radius}`;
  return cached(env, key, 'overpass', 5000, 30 * 60000, async () => {
    const area = `around:${radius + 150},${roundedLat},${roundedLon}`;
    const query = `[out:json][timeout:20];(nwr(${area})[amenity~"^(cafe|restaurant|internet_cafe)$"];nwr(${area})[leisure~"^(park|amusement_arcade|escape_game)$"];nwr(${area})[shop=mall];nwr(${area})[tourism~"^(attraction|museum|viewpoint)$"];nwr(${area})[amenity=place_of_worship][religion=hindu];);out center 300;`;
    return parsePlaces(await json(env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter', env, { method: 'POST', body: new URLSearchParams({ data: query }) }));
  });
}
export async function search(env: ProviderEnv, query: string) {
  const q = query.trim().replace(/\s+/g, ' ');
  return cached(env, `search:${env.NOMINATIM_URL}:${q.toLowerCase()}`, 'nominatim', 1500, 86400000, async () => {
    const url = new URL('search', (env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org').replace(/\/$/, '') + '/');
    url.search = new URLSearchParams({ q, format: 'jsonv2', addressdetails: '1', countrycodes: 'in', limit: '5' }).toString();
    return parseSearch(await json(url.toString(), env));
  });
}
export function parseSafetyPlaces(data: unknown): Place[] {
  if (!data || typeof data !== 'object' || !('elements' in data) || !Array.isArray(data.elements) || 'remark' in data) throw new ProviderError('Emergency place data is unavailable or incomplete. Call 112 for urgent help.');
  return data.elements.flatMap((item: { type?: string; id?: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Tags }) => {
    if (!item || !item.tags || !['node', 'way', 'relation'].includes(item.type || '') || !Number.isFinite(item.id)) return [];
    const tags = item.tags; const category = tags.amenity as typeof safetyCategories[number];
    const lat = item.lat ?? item.center?.lat; const lon = item.lon ?? item.center?.lon;
    if (!safetyCategories.includes(category) || !Number.isFinite(lat) || !Number.isFinite(lon)) return [];
    return [{ id: `${item.type}/${item.id}`, name: tags.name || `${category.replaceAll('_', ' ')} (name not listed)`, category, lat: lat!, lon: lon!, address: tags['addr:full'] || [tags['addr:street'], tags['addr:city']].filter(Boolean).join(', ') || 'Address not listed', hours: tags.opening_hours || 'Hours not listed', phone: normalizePhone(tags['contact:phone'] || tags.phone) }];
  }).slice(0, 300);
}
export async function safetyNearby(env: ProviderEnv, lat: number, lon: number) {
  const roundedLat = Number(lat.toFixed(3)); const roundedLon = Number(lon.toFixed(3));
  return cached(env, `safety:${env.OVERPASS_URL}:${roundedLat}:${roundedLon}`, 'overpass', 5000, 30 * 60000, async () => {
    const query = `[out:json][timeout:20];nwr(around:5150,${roundedLat},${roundedLon})[amenity~"^(police|hospital|pharmacy|clinic|doctors|fire_station)$"];out center 300;`;
    return parseSafetyPlaces(await json(env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter', env, { method: 'POST', body: new URLSearchParams({ data: query }) }));
  });
}
