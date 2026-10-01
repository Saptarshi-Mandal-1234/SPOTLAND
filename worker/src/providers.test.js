import { afterEach, expect, it, vi } from 'vitest';
import { nearby, parsePlaces, parseSearch, search, parseSafetyPlaces, safetyNearby } from './providers';
import { testDb } from './test-db.js';
afterEach(() => vi.unstubAllGlobals());
it('includes shopping centres, arcades, escape games, internet cafes and ordinary cafes', () => {
  const tags = [{ shop: 'mall' }, { leisure: 'amusement_arcade' }, { leisure: 'escape_game' }, { amenity: 'internet_cafe' }, { amenity: 'cafe' }];
  const places = parsePlaces({ elements: tags.map((tag, index) => ({ type: 'node', id: index, lat: 28, lon: 77, tags: { ...tag, name: `Place ${index}` } })) });
  expect(places.map(place => place.category)).toEqual(['shopping', 'gaming', 'gaming', 'gaming', 'cafe']);
});
it('requests the added categories upstream and bypasses the previous nearby cache', async () => {
  const db = testDb(); await db.prepare('INSERT INTO provider_cache (key, value, expires_at) VALUES (?, ?, ?)').bind('nearby:undefined:28:77:2000', '[]', Date.now() + 60000).run();
  const mock = vi.fn().mockResolvedValue(Response.json({ elements: [] })); vi.stubGlobal('fetch', mock);
  await nearby({ DB: db }, 28, 77, 2000); const query = mock.mock.calls[0][1].body.get('data');
  expect(query).toContain('[shop=mall]'); expect(query).toContain('amusement_arcade|escape_game'); expect(query).toContain('cafe|restaurant|internet_cafe');
});
it('preserves unnamed emergency facilities and sanitizes contact phones', () => {
  const data = { elements: [{ type: 'node', id: 1, lat: 28, lon: 77, tags: { amenity: 'hospital', 'contact:phone': '+91 1234567890' } }, { type: 'way', id: 2, center: { lat: 28, lon: 77 }, tags: { amenity: 'fire_station', name: 'Fire', phone: 'javascript:bad' } }, { type: 'node', id: 3, lat: 28, lon: 77, tags: { amenity: 'cafe', name: 'Cafe' } }] };
  expect(parseSafetyPlaces(data)).toMatchObject([{ name: 'hospital (name not listed)', phone: '+911234567890' }, { name: 'Fire', phone: undefined }]);
  expect(() => parseSafetyPlaces({ elements: [], remark: 'timeout' })).toThrow('incomplete');
});
it('caches safety queries and shares the Overpass gate with nearby queries', async () => {
  const mock = vi.fn().mockImplementation(() => Promise.resolve(Response.json({ elements: [] }))); vi.stubGlobal('fetch', mock);
  const env = { DB: testDb() }; await safetyNearby(env, 28.6, 77.2); await safetyNearby(env, 28.6, 77.2);
  expect(mock).toHaveBeenCalledTimes(1); expect(mock.mock.calls[0][1].body.get('data')).toContain('fire_station');
  await expect(nearby(env, 28.6, 77.2, 2000)).rejects.toMatchObject({ status: 429 });
});
it('maps named nodes and centered ways while preserving unknown hours', () => {
  expect(parsePlaces({ elements: [{ type: 'node', id: 1, lat: 28, lon: 77, tags: { amenity: 'cafe', name: 'Chai' } }, { type: 'way', id: 2, center: { lat: 28, lon: 77 }, tags: { leisure: 'park', name: 'Park', opening_hours: '24/7' } }, { id: 3, tags: { amenity: 'cafe' } }] })).toMatchObject([{ id: 'node/1', category: 'cafe', hours: 'Hours not listed' }, { id: 'way/2', category: 'park', hours: '24/7' }]);
});
it('rejects malformed and partial timeout results', () => {
  expect(() => parsePlaces({})).toThrow(); expect(() => parsePlaces({ elements: [], remark: 'timeout' })).toThrow();
  expect(parseSearch([{ display_name: 'Delhi', lat: '28.6', lon: '77.2', address: { state: 'Delhi' } }, { lat: 'bad' }])).toEqual([{ name: 'Delhi', lat: 28.6, lon: 77.2, state: 'Delhi' }]);
});
it('caches searches and enforces a shared rate limit on distinct queries', async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json([{ display_name: 'Delhi', lat: '28.6', lon: '77.2' }])); vi.stubGlobal('fetch', fetchMock);
  const env = { DB: testDb(), NOMINATIM_URL: 'https://example.org', PROVIDER_USER_AGENT: 'TravelApp/test' };
  await search(env, 'Delhi'); await search(env, 'delhi'); expect(fetchMock).toHaveBeenCalledTimes(1);
  await expect(search(env, 'Mumbai')).rejects.toMatchObject({ status: 429 });
  expect(fetchMock.mock.calls[0][0]).toContain('countrycodes=in');
});
it('caches nearby places, reports provider failures, and requires D1', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ elements: [] })));
  const env = { DB: testDb() }; await nearby(env, 28.6, 77.2, 2000); await nearby(env, 28.6, 77.2, 2000);
  expect(fetch).toHaveBeenCalledTimes(1);
  await expect(nearby({}, 28, 77, 2000)).rejects.toMatchObject({ status: 503 });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
  await expect(search({ DB: testDb() }, 'Delhi')).rejects.toMatchObject({ status: 502 });
});


