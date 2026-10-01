import { distanceKm } from '../../shared/places';
import type { Point, Route, TravelMode } from '../../shared/routes';
import { readCache, reserveProvider, writeCache } from './db';
import { ProviderError, type ProviderEnv } from './providers';
export interface RoutingEnv extends ProviderEnv { OSRM_URL_TEMPLATE?: string }
interface OsrmStep { name?: string; distance: number; maneuver: { type: string; modifier?: string; exit?: number } }
export function instruction(step: OsrmStep) {
  const type = step.maneuver.type; const modifier = step.maneuver.modifier?.replaceAll('_', ' ') || '';
  const road = step.name ? ` onto ${step.name}` : '';
  if (type === 'depart') return `Start${step.name ? ` on ${step.name}` : ''}`;
  if (type === 'arrive') return 'Arrive at your destination';
  if (type.includes('roundabout') || type === 'rotary') return `At the roundabout${step.maneuver.exit ? `, take exit ${step.maneuver.exit}` : ''}${road}`;
  if (type === 'turn') return `Turn ${modifier || 'ahead'}${road}`;
  if (type === 'fork') return `Keep ${modifier || 'ahead'} at the fork${road}`;
  if (type === 'merge') return `Merge ${modifier}${road}`.trim();
  return `${type === 'continue' || type === 'new name' ? 'Continue' : type.replaceAll('_', ' ')}${modifier ? ` ${modifier}` : ''}${road}`;
}
export function parseRoute(data: unknown, mode: TravelMode): Route {
  if (!data || typeof data !== 'object' || !('code' in data)) throw new ProviderError('Unexpected routing response.');
  if (data.code === 'NoRoute' || data.code === 'NoSegment') throw new ProviderError('No route found for this travel mode. Try another start or mode.', 404);
  if (data.code !== 'Ok' || !('routes' in data) || !Array.isArray(data.routes)) throw new ProviderError('Routing provider is unavailable.');
  const route = data.routes[0] as { distance: number; duration: number; geometry?: Route['geometry']; legs?: { steps?: OsrmStep[] }[] } | undefined;
  if (!route || !Number.isFinite(route.distance) || route.distance < 0 || !Number.isFinite(route.duration) || route.duration < 0 || route.geometry?.type !== 'LineString' || !Array.isArray(route.geometry.coordinates) || route.geometry.coordinates.length < 2 || route.geometry.coordinates.some(point => !Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite) || Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90)) throw new ProviderError('Routing provider returned an invalid route.');
  const steps = (route.legs || []).flatMap(leg => leg.steps || []);
  if (!steps.length || steps.some(step => !step.maneuver || typeof step.maneuver.type !== 'string' || !Number.isFinite(step.distance) || step.distance < 0)) throw new ProviderError('Routing provider returned invalid steps.');
  return { mode, distance: route.distance, duration: route.duration, geometry: route.geometry, steps: steps.map(step => ({ instruction: instruction(step), distance: step.distance })) };
}
export function validPoint(point: Point) { return Number.isFinite(point.lat) && Number.isFinite(point.lon) && point.lat >= 6 && point.lat <= 38 && point.lon >= 68 && point.lon <= 98; }
export async function getRoute(env: RoutingEnv, start: Point, end: Point, mode: TravelMode): Promise<Route> {
  return getRoutePoints(env,[start,end],mode);
}
export async function getRoutePoints(env: RoutingEnv, points: Point[], mode: TravelMode): Promise<Route> {
  if (!Array.isArray(points) || points.length < 2 || points.length > 8 || points.some(point => !point || !validPoint(point) || distanceKm(points[0],point) > 100) || !['walk', 'drive', 'cycle'].includes(mode)) throw new ProviderError('Choose two to eight locations in India within 100 km of the start and a supported mode.', 400);
  if (!env.DB) throw new ProviderError('Routing needs the configured D1 database.', 503);
  // Round location before sending it to the provider or storing cache keys.
  const coords = points.map(point => `${point.lon.toFixed(3)},${point.lat.toFixed(3)}`).join(';');
  const template = env.OSRM_URL_TEMPLATE || 'https://routing.openstreetmap.de/routed-{profile}/route/v1/driving/';
  const profile = { walk: 'foot', drive: 'car', cycle: 'bike' }[mode];
  const url = `${template.replace('{profile}', profile).replace(/\/$/, '')}/${coords}?overview=full&steps=true&geometries=geojson&alternatives=false`;
  const key = `route:${mode}:${url}`; const cached = await readCache(env.DB, key); if (cached) return cached as Route;
  if (!await reserveProvider(env.DB, 'routing', 1500)) throw new ProviderError('Routing is busy. Wait a few seconds and retry.', 429);
  let response: Response;
  try { response = await fetch(url, { headers: { 'User-Agent': env.PROVIDER_USER_AGENT || 'TravelApp/0.1 (local development)' }, signal: AbortSignal.timeout(25000) }); }
  catch { throw new ProviderError('Routing timed out or is unreachable. Please retry.'); }
  if (!response.ok) throw new ProviderError('Routing provider is temporarily unavailable.', response.status === 429 ? 429 : 502);
  const data = await response.json();
  const route = parseRoute(data, mode);
  if (data.routes[0].legs.length !== points.length - 1) throw new ProviderError('Routing provider omitted a trip leg. Retry the full itinerary.');
  await writeCache(env.DB, key, route, 10 * 60000); return route;
}
