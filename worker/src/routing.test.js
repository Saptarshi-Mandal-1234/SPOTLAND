import { afterEach, expect, it, vi } from 'vitest';
import { getRoute, getRoutePoints, instruction, parseRoute } from './routing';
import { testDb } from './test-db.js';
afterEach(() => vi.unstubAllGlobals());
const fixture = { code: 'Ok', routes: [{ distance: 1300, duration: 900, geometry: { type: 'LineString', coordinates: [[77.209, 28.614], [77.22, 28.615]] }, legs: [{ steps: [{ name: 'Janpath', distance: 1200, maneuver: { type: 'depart' } }, { distance: 100, maneuver: { type: 'turn', modifier: 'right' } }, { distance: 0, maneuver: { type: 'arrive' } }] }] }] };
it('routes every stop in order with one cached provider request and rejects omitted legs', async () => {
  const points=[{lat:28.614,lon:77.209},{lat:28.615,lon:77.22},{lat:28.62,lon:77.23}];
  const multi={...fixture,routes:[{...fixture.routes[0],legs:[fixture.routes[0].legs[0],fixture.routes[0].legs[0]]}]};
  const f=vi.fn().mockImplementation(async()=>Response.json(multi));vi.stubGlobal('fetch',f);const env={DB:testDb()};
  const result=await getRoutePoints(env,points,'walk');await getRoutePoints(env,points,'walk');expect(f).toHaveBeenCalledTimes(1);expect(f.mock.calls[0][0]).toContain('77.209,28.614;77.220,28.615;77.230,28.620');expect(result.steps).toHaveLength(6);
  f.mockImplementation(async()=>Response.json(fixture));await expect(getRoutePoints({DB:testDb()},points,'walk')).rejects.toThrow('omitted a trip leg');
});
it('normalizes geometry, totals, and readable maneuvers', () => {
  expect(parseRoute(fixture, 'walk')).toMatchObject({ distance: 1300, duration: 900, mode: 'walk', steps: [{ instruction: 'Start on Janpath' }, { instruction: 'Turn right' }, { instruction: 'Arrive at your destination' }] });
  expect(instruction({ distance: 10, name: 'Road', maneuver: { type: 'roundabout', exit: 2 } })).toBe('At the roundabout, take exit 2 onto Road');
});
it('rejects no-route, missing steps and malformed geometry', () => {
  expect(() => parseRoute({ code: 'NoRoute' }, 'drive')).toThrow('No route found');
  expect(() => parseRoute({ code: 'Ok', routes: [{ ...fixture.routes[0], geometry: { type: 'LineString', coordinates: [['bad', 28], [77, 28]] } }] }, 'walk')).toThrow('invalid route');
  expect(() => parseRoute({ code: 'Ok', routes: [{ ...fixture.routes[0], legs: [] }] }, 'walk')).toThrow('invalid steps');
});
it('selects each provider profile, caches results and enforces a shared cooldown', async () => {
  const mock = vi.fn().mockImplementation(() => Promise.resolve(Response.json(fixture))); vi.stubGlobal('fetch', mock);
  const env = { DB: testDb() }; const start = { lat: 28.6139, lon: 77.209 }; const end = { lat: 28.615, lon: 77.22 };
  await getRoute(env, start, end, 'walk'); await getRoute(env, start, end, 'walk'); expect(mock).toHaveBeenCalledTimes(1);
  expect(mock.mock.calls[0][0]).toContain('routed-foot/'); expect(mock.mock.calls[0][0]).toContain('77.209,28.614');
  await expect(getRoute(env, start, end, 'drive')).rejects.toMatchObject({ status: 429 });
  await getRoute({ DB: testDb() }, start, end, 'drive'); expect(mock.mock.calls[1][0]).toContain('routed-car/');
  await getRoute({ DB: testDb() }, start, end, 'cycle'); expect(mock.mock.calls[2][0]).toContain('routed-bike/');
});
it('validates bounds/modes and reports upstream errors without caching them', async () => {
  const env = { DB: testDb() }; const start = { lat: 28.6, lon: 77.2 }; const end = { lat: 28.61, lon: 77.21 };
  await expect(getRoute(env, start, end, 'air')).rejects.toMatchObject({ status: 400 });
  await expect(getRoute(env, start, { lat: 10, lon: 77 }, 'walk')).rejects.toMatchObject({ status: 400 });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
  await expect(getRoute(env, start, end, 'walk')).rejects.toMatchObject({ status: 502 });
});
