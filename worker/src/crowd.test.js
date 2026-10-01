import { afterEach, expect, it, vi } from 'vitest';
import { estimateCrowd } from '../../shared/crowd';
import { crowdApi } from './crowd';
import worker from './index';
import { testDb } from './test-db.js';
const now = Date.parse('2026-09-30T12:00:00+05:30');
afterEach(() => vi.useRealTimers());
it('requires sufficient matching history and returns empirical busy percentage', () => {
  const reports = Array.from({ length: 15 }, (_, i) => ({ level: i < 9 ? 'busy' : 'quiet', created_at: now - (1 + i % 3) * 7 * 86400000 }));
  expect(estimateCrowd(reports, now)).toEqual({ percentage: 60, samples: 15, dates: 3 });
  expect(estimateCrowd(reports.slice(0, 14), now).percentage).toBeNull();
  expect(estimateCrowd(reports.map(r => ({ ...r, created_at: now })), now).percentage).toBeNull();
  expect(estimateCrowd([...reports, { level: 'busy', created_at: now + 1 }, { level: 'busy', created_at: now - 91 * 86400000 }, { level: 'busy', created_at: now - 86400000 }, { level: 'busy', created_at: now - 7 * 86400000 + 3 * 3600000 }], now).samples).toBe(15);
});
it('stores voluntary reports, prevents duplicates, validates inputs and expires history', async () => {
  vi.useFakeTimers(); vi.setSystemTime(now);
  const env = { DB: testDb(), ALLOWED_ORIGIN: 'https://app.example' };
  const request = (body, origin = env.ALLOWED_ORIGIN) => new Request('https://api.example/api/crowd?placeId=node/123', { method: body ? 'POST' : 'GET', headers: { Origin: origin, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  expect(await crowdApi(request(), env)).toEqual({ percentage: null, samples: 0, dates: 0 });
  expect(await crowdApi(request({ placeId: 'node/123', level: 'busy' }), env)).toEqual({ percentage: null, samples: 1, dates: 1 });
  await expect(crowdApi(request({ placeId: 'node/123', level: 'quiet' }), env)).rejects.toMatchObject({ status: 429 });
  await expect(crowdApi(request({ placeId: 'node/123', level: 'made-up' }), env)).rejects.toMatchObject({ status: 400 });
  await expect(crowdApi(request({ placeId: 'bad', level: 'busy' }), env)).rejects.toMatchObject({ status: 400 });
  await expect(crowdApi(request({ placeId: 'node/123', level: 'busy' }, 'https://other.example'), env)).rejects.toMatchObject({ status: 403 });
  vi.setSystemTime(now + 91 * 86400000); expect((await crowdApi(request(), env)).samples).toBe(0);
  expect((await crowdApi(new Request('https://api.example/api/crowd?placeId=seed:ihc'), env)).percentage).toBeNull();
  expect((await crowdApi(new Request('https://api.example/api/crowd?placeId=12345678-1234-1234-1234-123456789abc'), env)).percentage).toBeNull();
});
it('permits cross-origin JSON preflight only for the configured app origin', async () => {
  for (const path of ['/api/events', '/api/admin/events', '/api/crowd', '/api/venues', '/api/admin/venues', '/api/venue-reports', '/api/admin/venue-reports']) {
    const response = await worker.fetch(new Request('https://api.example' + path, { method: 'OPTIONS', headers: { Origin: 'https://app.example' } }), { ALLOWED_ORIGIN: 'https://app.example' });
    expect(response.status).toBe(204); expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
    expect((await worker.fetch(new Request('https://api.example' + path, { method: 'OPTIONS', headers: { Origin: 'https://other.example' } }), { ALLOWED_ORIGIN: 'https://app.example' })).status).toBe(403);
  }
});
