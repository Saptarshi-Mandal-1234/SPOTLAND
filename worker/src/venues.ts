import { validateVenue, safeWebsite, type Venue, type VenueKind } from '../../shared/venues';
import { normalizePhone } from '../../shared/safety';
import { distanceKm } from '../../shared/places';
import { indiaDate } from '../../shared/calendar';
import { readCache, reserveProvider, writeCache } from './db';
import { bodyJson, requireDb, requireOrigin, requireAdmin, limitSubmission, type EventsEnv } from './events';
import { ProviderError, type ProviderEnv } from './providers';
import { venueSeed } from './venue-seed';
interface Stored { id: string; data: string; booking_links: string; price_note: string; price_updated_at: string | null; status: Venue['status'] }
function stored(row: Stored): Venue { return { ...JSON.parse(row.data), id: row.id, booking_links: JSON.parse(row.booking_links), price_note: row.price_note, price_updated_at: row.price_updated_at, status: row.status, source: 'community' }; }
export function parseVenues(data: unknown): Venue[] {
  const elements = (data as { elements?: unknown })?.elements;
  if (!Array.isArray(elements) || (data as { remark?: string }).remark) throw new ProviderError('Venue data is incomplete. Try again.', 502);
  return elements.flatMap(item => {
    const t = item?.tags; const lat = item?.lat ?? item?.center?.lat; const lon = item?.lon ?? item?.center?.lon;
    if (!t || typeof t.name !== 'string' || !['node', 'way', 'relation'].includes(item.type) || !Number.isSafeInteger(item.id) || !Number.isFinite(lat) || !Number.isFinite(lon) || lat < 6 || lat > 38 || lon < 68 || lon > 98) return [];
    const kind: VenueKind | null = t.amenity === 'cinema' ? 'cinema' : t.amenity === 'theatre' ? 'theatre' : ['internet_cafe'].includes(t.amenity) || ['adult_gaming_centre', 'amusement_arcade', 'escape_game'].includes(t.leisure) || t.shop === 'video_games' ? 'gaming' : ['community_centre', 'studio'].includes(t.amenity) ? 'workshop' : null;
    if (!kind) return [];
    return [{ id: `${item.type}/${item.id}`, name: t.name.slice(0, 100), kind, city: t['addr:city'] || '', address: t['addr:full'] || [t['addr:street'], t['addr:city']].filter(Boolean).join(', ') || 'Address not listed', hours: t.opening_hours || 'Hours not listed', lat, lon, phone: normalizePhone(t['contact:phone'] || t.phone), website: safeWebsite(t['contact:website'] || t.website), booking_links: [], price_note: t.charge ? String(t.charge).slice(0, 160) : 'Price not supplied.', price_updated_at: null, source: 'osm' as const, sourceUrl: `https://www.openstreetmap.org/${item.type}/${item.id}`, status: 'approved' as const }];
  }).slice(0, 200);
}
async function osmVenues(env: ProviderEnv, lat: number, lon: number) {
  const db = requireDb(env); const point = { lat: Number(lat.toFixed(3)), lon: Number(lon.toFixed(3)) }; const endpoint = env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';
  const key = `venues:v1:${endpoint}:${point.lat}:${point.lon}`; const hit = await readCache(db, key); if (hit !== null) return hit as Venue[];
  if (!await reserveProvider(db, 'overpass', 5000)) throw new ProviderError('Venue provider busy. Wait five seconds and retry.', 429);
  const area = `around:5150,${point.lat},${point.lon}`;
  const query = `[out:json][timeout:20];(nwr(${area})[amenity~"^(cinema|theatre|internet_cafe|community_centre|studio)$"];nwr(${area})[leisure~"^(adult_gaming_centre|amusement_arcade|escape_game)$"];nwr(${area})[shop=video_games];);out center 200;`;
  let response; try { response = await fetch(endpoint, { method: 'POST', body: new URLSearchParams({ data: query }), headers: { 'User-Agent': env.PROVIDER_USER_AGENT || 'SPOTLAND/0.1' }, signal: AbortSignal.timeout(25000) }); } catch { throw new ProviderError('OSM venues unavailable. Pilot picks and approved submissions still work.', 502); }
  if (!response.ok) throw new ProviderError('Venue provider unavailable.', response.status === 429 ? 429 : 502);
  const result = parseVenues(await response.json()); await writeCache(db, key, result, 30 * 60000); return result;
}
export async function venueApi(request: Request, env: EventsEnv & ProviderEnv) {
  const db = requireDb(env); const url = new URL(request.url); const admin = url.pathname.startsWith('/api/admin/'); const reports = url.pathname.endsWith('venue-reports');
  if (admin) await requireAdmin(request, env);
  if (request.method === 'GET') {
    if (reports) { if (!admin) throw new ProviderError('Moderator access required.', 401); return (await db.prepare("SELECT * FROM venue_reports WHERE status='pending' ORDER BY created_at LIMIT 100").all()).results; }
    if (admin) return (await db.prepare("SELECT * FROM venues WHERE status='pending' ORDER BY created_at LIMIT 100").all<Stored>()).results.map(stored);
    const lat = Number(url.searchParams.get('lat')); const lon = Number(url.searchParams.get('lon')); const city = url.searchParams.get('city') || '';
    if (!url.searchParams.has('lat') || !url.searchParams.has('lon') || ![lat, lon].every(Number.isFinite) || lat < 6 || lat > 38 || lon < 68 || lon > 98 || city.length > 80) throw new ProviderError('Choose a venue area in India.', 400);
    const community = (await db.prepare("SELECT * FROM venues WHERE status='approved' ORDER BY created_at DESC LIMIT 300").all<Stored>()).results.map(stored).filter(venue => distanceKm({ lat, lon }, { lat: venue.lat!, lon: venue.lon! }) <= 5);
    let osm: Venue[] = []; let warning = ''; try { osm = await osmVenues(env, lat, lon); } catch (error) { warning = (error as Error).message; }
    const venues = [...community, ...osm.filter(venue => distanceKm({ lat, lon }, { lat: venue.lat!, lon: venue.lon! }) <= 5)];
    for (const seed of venueSeed.filter(venue => venue.city.toLowerCase() === city.toLowerCase())) {
      const match = venues.find(venue => venue.source === 'osm' && venue.name.trim().toLowerCase() === seed.name.toLowerCase());
      if (match) { match.website ||= seed.website; match.phone ||= seed.phone; match.directorySourceUrl = seed.sourceUrl; }
      else venues.push(seed);
    }
    return { venues, warning };
  }
  if (request.method !== 'POST') throw new ProviderError('Method not allowed.', 405);
  requireOrigin(request, env.ALLOWED_ORIGIN); const data = await bodyJson(request, 8192);
  if (!data || typeof data !== 'object') throw new ProviderError('Invalid venue data.', 400);
  if (reports) {
    if (admin) { if (typeof data.id !== 'string') throw new ProviderError('Invalid report.', 400); const row = await db.prepare("UPDATE venue_reports SET status='resolved' WHERE id=? AND status='pending' RETURNING id").bind(data.id).first(); if (!row) throw new ProviderError('Report no longer pending.', 409); return { status: 'resolved' }; }
    if (typeof data.venueId !== 'string' || !/^(seed:[a-z-]+|(node|way|relation)\/\d{1,16}|[a-f0-9-]{36})$/.test(data.venueId) || typeof data.reason !== 'string' || data.reason.trim().length < 10 || data.reason.length > 300) throw new ProviderError('Describe the incorrect price (10–300 characters).', 400);
    await limitSubmission(db, request, 'venue-reports'); await db.prepare('INSERT INTO venue_reports (id,venue_id,reason,created_at) VALUES (?,?,?,?)').bind(crypto.randomUUID(), data.venueId, data.reason.trim(), Date.now()).run(); return { status: 'pending' };
  }
  if (admin) {
    if (typeof data.id !== 'string' || !['approved', 'rejected'].includes(data.status)) throw new ProviderError('Invalid moderation choice.', 400);
    const row = await db.prepare('UPDATE venues SET status=? WHERE id=? RETURNING id').bind(data.status, data.id).first(); if (!row) throw new ProviderError('Venue not found.', 404); return { status: data.status };
  }
  let venue; try { venue = validateVenue(data); } catch (error) { throw new ProviderError((error as Error).message, 400); }
  await limitSubmission(db, request, 'venues'); const id = crypto.randomUUID();
  await db.prepare("INSERT INTO venues (id,data,booking_links,price_note,price_updated_at,status,created_at) VALUES (?,?,?,?,?,'pending',?)").bind(id, JSON.stringify(venue), JSON.stringify(venue.booking_links), venue.price_note, indiaDate(), Date.now()).run(); return { id, status: 'pending' };
}
