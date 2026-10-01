import { nearby, search, safetyNearby, ProviderError, type ProviderEnv } from './providers';
import { getRoute, getRoutePoints, type RoutingEnv } from './routing';
import { tripsApi } from './trips';
import { reviewsApi } from './reviews';
import { reviewPhotoApi, reviewPhotoImage, type ReviewPhotoEnv } from './review-photos';
import { validateTrip } from '../../shared/trips';
import { bodyJson, requireOrigin } from './events';
import type { TravelMode } from '../../shared/routes';
import { getWeather, type WeatherEnv } from './weather';
import { eventApi, type EventsEnv } from './events';
import { crowdApi } from './crowd';
import { externalEvents, type ExternalEventsEnv } from './external-events';
import { venueApi } from './venues';
import { accountsApi, type AccountsEnv } from './accounts';
import { liveShareApi, type LiveShareEnv } from './live-share';
import { sosApi, dispatchSosPush, type SosEnv } from './sos';
import { cleanupExpiredData } from './expiry-cleanup';
interface Env extends ProviderEnv, RoutingEnv, WeatherEnv, EventsEnv, ExternalEventsEnv, AccountsEnv, LiveShareEnv, SosEnv, ReviewPhotoEnv { ALLOWED_ORIGIN: string }
export default {
  async scheduled(_controller: unknown, env: Env) { await cleanupExpiredData(env); await dispatchSosPush(env); },
  async fetch(request: Request, env: Env, ctx?: { waitUntil: (promise: Promise<unknown>) => void }): Promise<Response> {
    const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin' });
    if (request.headers.get('Origin') === env.ALLOWED_ORIGIN) headers.set('Access-Control-Allow-Origin', env.ALLOWED_ORIGIN);
    const url = new URL(request.url); const path = url.pathname;
    const photoId = path.match(/^\/api\/(admin\/)?review-photos\/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/)?.[2];
    if (photoId) {
      try { return await reviewPhotoImage(request,env,photoId); }
      catch (error) { return new Response(JSON.stringify({error:error instanceof ProviderError ? error.message : 'Photo unavailable.'}),{status:error instanceof ProviderError ? error.status : 503,headers}); }
    }
    if (path === '/api/review-photos' || path === '/api/admin/review-photos') {
      try { return new Response(JSON.stringify(await reviewPhotoApi(request,env)),{headers}); }
      catch (error) { return new Response(JSON.stringify({error:error instanceof ProviderError ? error.message : 'Photo request failed. Retry.'}),{status:error instanceof ProviderError ? error.status : 503,headers}); }
    }
    if (path === '/api/reviews' || path === '/api/admin/reviews') {
      try { return new Response(JSON.stringify(await reviewsApi(request,env)),{headers}); }
      catch (e) { return new Response(JSON.stringify({error:e instanceof ProviderError ? e.message : 'Reviews unavailable. Your change is not confirmed; retry.'}),{status:e instanceof ProviderError ? e.status : 503,headers}); }
    }
    if (path === '/api/trips' || path === '/api/trip-route') {
      try {
        if (path === '/api/trips') return new Response(JSON.stringify(await tripsApi(request,env)),{headers});
        if (request.method !== 'POST') throw new ProviderError('Method not allowed.',405);
        requireOrigin(request,env.ALLOWED_ORIGIN);
        let trip; try { trip = validateTrip(await bodyJson(request,10000)); } catch (e) { if (e instanceof ProviderError) throw e; throw new ProviderError((e as Error).message,400); }
        return new Response(JSON.stringify(await getRoutePoints(env,trip.stops,trip.mode)),{headers});
      } catch (e) { return new Response(JSON.stringify({error:e instanceof ProviderError ? e.message : 'Trip service unavailable. Your plan was not confirmed; retry.'}),{status:e instanceof ProviderError ? e.status : 503,headers}); }
    }
    if (['/api/sos-config','/api/sos','/api/nearby-alerts'].includes(path)) {
      headers.set('Referrer-Policy','no-referrer');
      try {
        const result = await sosApi(request,env);
        if (path === '/api/sos' && 'id' in result && typeof result.id === 'string') { const send = dispatchSosPush(env,result.id).catch(() => {}); if (ctx) ctx.waitUntil(send); else await send; }
        return new Response(JSON.stringify(result),{headers});
      } catch (error) { return new Response(JSON.stringify({error:error instanceof ProviderError ? error.message : 'Safety request failed. Alert NOT confirmed; retry or Call 112.'}),{status:error instanceof ProviderError ? error.status : 503,headers}); }
    }
    if (['/api/share-device', '/api/live-share'].includes(path)) {
      headers.set('Referrer-Policy', 'no-referrer');
      try { return new Response(JSON.stringify(await liveShareApi(request, env, headers)), { headers }); }
      catch (error) { return new Response(JSON.stringify({ error: error instanceof ProviderError ? error.message : 'Location sharing unavailable. Retry shortly.' }), { status: error instanceof ProviderError ? error.status : 503, headers }); }
    }
    if (['/api/auth/config', '/api/auth/session', '/api/auth/challenge', '/api/auth/google', '/api/auth/logout', '/api/favorites'].includes(path)) {
      // Accounts use same-origin cookies; the Pages function and Vite proxy provide /api.
      if (request.method === 'OPTIONS') return new Response(null, { status: 403, headers });
      try { return new Response(JSON.stringify(await accountsApi(request, env, headers)), { headers }); }
      catch (error) { return new Response(JSON.stringify({ error: error instanceof ProviderError ? error.message : 'Account service unavailable. Try again.' }), { status: error instanceof ProviderError ? error.status : 503, headers }); }
    }
    if (['/api/events', '/api/admin/events', '/api/crowd', '/api/venues', '/api/admin/venues', '/api/venue-reports', '/api/admin/venue-reports'].includes(path)) {
      if (request.method === 'OPTIONS') {
        if (request.headers.get('Origin') !== env.ALLOWED_ORIGIN) return new Response(null, { status: 403, headers });
        headers.set('Access-Control-Allow-Methods', 'GET, POST'); headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        return new Response(null, { status: 204, headers });
      }
      try { return new Response(JSON.stringify(await (path.includes('venue') ? venueApi(request, env) : path === '/api/crowd' ? crowdApi(request, env) : eventApi(request, env))), { headers }); }
      catch (error) { return new Response(JSON.stringify({ error: error instanceof ProviderError ? error.message : 'Events unavailable. Try again.' }), { status: error instanceof ProviderError ? error.status : 503, headers }); }
    }
    if (!['/api/health', '/api/nearby', '/api/search', '/api/map-config', '/api/route', '/api/safety', '/api/weather', '/api/external-events'].includes(path)) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
    if (request.method !== 'GET') { headers.set('Allow', 'GET'); return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers }); }
    try {
      let result: unknown;
      if (path === '/api/health') result = { status: 'ok', message: 'Hello from your travel companion.' };
      else if (path === '/api/external-events') result = await externalEvents(env);
      else if (path === '/api/map-config') result = { tileUrl: env.TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors' };
      else if (path === '/api/route') {
        const keys = ['startLat', 'startLon', 'endLat', 'endLon'];
        if (keys.some(key => !url.searchParams.get(key)?.trim())) throw new ProviderError('Start and destination coordinates are required.', 400);
        result = await getRoute(env, { lat: Number(url.searchParams.get('startLat')), lon: Number(url.searchParams.get('startLon')) }, { lat: Number(url.searchParams.get('endLat')), lon: Number(url.searchParams.get('endLon')) }, url.searchParams.get('mode') as TravelMode);
      }
      else if (path === '/api/search') {
        const q = url.searchParams.get('q')?.trim() || '';
        if (q.length < 2 || q.length > 120) return new Response(JSON.stringify({ error: 'Search must be 2–120 characters.' }), { status: 400, headers });
        result = await search(env, q);
      } else {
        const lat = Number(url.searchParams.get('lat')); const lon = Number(url.searchParams.get('lon')); const radius = Number(url.searchParams.get('radius') || 2000);
        if (!url.searchParams.has('lat') || !url.searchParams.has('lon') || !Number.isFinite(lat) || !Number.isFinite(lon) || lat < 6 || lat > 38 || lon < 68 || lon > 98 || ![1000, 2000, 5000].includes(radius)) return new Response(JSON.stringify({ error: 'Choose a location in India and a 1, 2, or 5 km radius.' }), { status: 400, headers });
        result = path === '/api/weather' ? await getWeather(env, lat, lon) : path === '/api/safety' ? await safetyNearby(env, lat, lon) : await nearby(env, lat, lon, radius);
      }
      return new Response(JSON.stringify(result), { headers });
    } catch (error) {
      const status = error instanceof ProviderError ? error.status : 503;
      if (status === 429 && path !== '/api/external-events') headers.set('Retry-After', path === '/api/weather' ? '18' : '5');
      return new Response(JSON.stringify({ error: error instanceof ProviderError ? error.message : 'Places are unavailable. Please try again.' }), { status, headers });
    }
  },
};

