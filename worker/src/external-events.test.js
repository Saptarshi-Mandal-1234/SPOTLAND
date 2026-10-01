import { afterEach, expect, it, vi } from 'vitest';
import { externalEvents, eventsQuery, parseExternalEvents } from './external-events';
import { testDb } from './test-db.js';
import worker from './index';
const now = Date.parse('2026-09-30T12:00:00+05:30');
const binding = (changes = {}) => ({ item: { value: 'http://www.wikidata.org/entity/Q123' }, itemLabel: { value: 'Example public exhibition' }, date: { value: '2026-10-02T00:00:00Z' }, precision: { value: '11' }, locationLabel: { value: 'Delhi' }, ...changes });
const payload = (...rows) => ({ results: { bindings: rows } });
const env = () => ({ DB: testDb(), WIKIDATA_USER_AGENT: 'SPOTLAND-Test/0.1 (https://spotland.test/contact)' });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it('normalizes provider rows, keeps unlocated events and rejects invalid or imprecise records', () => {
  const valid = binding({ coord: { value: 'Point(77.2 28.6)' } });
  const result = parseExternalEvents(payload(valid, valid, binding({ item: { value: 'https://www.wikidata.org/entity/Q124' }, coord: { value: 'Point(0 0)' } }), binding({ precision: { value: '9' } }), binding({ date: { value: '2026-02-30T00:00:00Z' } }), binding({ item: { value: 'https://evil.test/Q123' } }), binding({ date: { value: '2027-10-02T00:00:00Z' } }), null), now);
  expect(result.events).toHaveLength(2); expect(result.events[0].sourceUrl).toBe('https://www.wikidata.org/wiki/Q123');
  expect(result.events[0].point).toEqual({ lat: 28.6, lon: 77.2 }); expect(result.events[1].point).toBeUndefined();
  expect(parseExternalEvents(payload(), now).events).toEqual([]);
  expect(() => parseExternalEvents({}, now)).toThrow();
  expect(eventsQuery(now)).toContain('?precision >= 11'); expect(eventsQuery(now)).toContain('LIMIT 200');
});
it('stays disconnected without a real identifying contact and rejects non-GET API requests', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  for (const agent of [undefined, 'SPOTLAND/0.1', 'SPOTLAND/0.1 (https://example.org)', 'SPOTLAND/0.1 (http://localhost)']) await expect(externalEvents({ DB: testDb(), WIKIDATA_USER_AGENT: agent })).rejects.toMatchObject({ status: 503 });
  expect(fetch).not.toHaveBeenCalled();
  expect((await worker.fetch(new Request('https://api.test/api/external-events', { method: 'POST' }), { ALLOWED_ORIGIN: 'https://app.test' })).status).toBe(405);
});
it('caches successful results, including empty responses, across users', async () => {
  vi.useFakeTimers(); vi.setSystemTime(now); const config = env();
  const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify(payload()), { status: 200 })); vi.stubGlobal('fetch', fetch);
  const first = await externalEvents(config); expect(first.events).toEqual([]);
  expect(await externalEvents(config)).toEqual(first); expect(fetch).toHaveBeenCalledTimes(1);
  const [url, init] = fetch.mock.calls[0]; expect(new URL(url).searchParams.get('timeout')).toBe('20000'); expect(init.headers['User-Agent']).toBe(config.WIKIDATA_USER_AGENT);
  vi.setSystemTime(now + 6 * 3600000 + 1); await externalEvents(config); expect(fetch).toHaveBeenCalledTimes(2);
});
it('honours provider Retry-After across users and resumes only after backoff', async () => {
  vi.useFakeTimers(); vi.setSystemTime(now); const config = env();
  const fetch = vi.fn().mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '600' } })).mockResolvedValue(new Response(JSON.stringify(payload()), { status: 200 })); vi.stubGlobal('fetch', fetch);
  await expect(externalEvents(config)).rejects.toMatchObject({ status: 429 });
  vi.setSystemTime(now + 61000); await expect(externalEvents(config)).rejects.toMatchObject({ status: 429 }); expect(fetch).toHaveBeenCalledTimes(1);
  vi.setSystemTime(now + 601000); expect((await externalEvents(config)).events).toEqual([]); expect(fetch).toHaveBeenCalledTimes(2);
});
it('does not cache invalid data or failures and gates repeated upstream requests', async () => {
  vi.useFakeTimers(); vi.setSystemTime(now); const config = env();
  const fetch = vi.fn().mockResolvedValueOnce(new Response('{}')).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(new Response('', { status: 500 })); vi.stubGlobal('fetch', fetch);
  await expect(externalEvents(config)).rejects.toMatchObject({ status: 502 });
  await expect(externalEvents(config)).rejects.toMatchObject({ status: 429 });
  vi.setSystemTime(now + 60000); await expect(externalEvents(config)).rejects.toMatchObject({ status: 502 });
  vi.setSystemTime(now + 120000); await expect(externalEvents(config)).rejects.toMatchObject({ status: 502 }); expect(fetch).toHaveBeenCalledTimes(3);
});
