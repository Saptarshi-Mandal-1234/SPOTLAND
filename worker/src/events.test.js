import { afterEach, expect, it, vi } from 'vitest';
import { testDb } from './test-db.js';
import { eventApi } from './events';
import { validateEvent } from '../../shared/events';
const now = Date.parse('2026-09-30T12:00:00+05:30');
const input = { name: 'Public art walk', date: '2026-10-02', address: 'Public museum, Delhi', description: 'A public walk through the local art display.', lat: 28.6, lon: 77.2 };
const make = (path, body, token, origin = 'https://spotland.example') => new Request(`https://api.example${path}`, { method: body ? 'POST' : 'GET', headers: { Origin: origin, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
afterEach(() => vi.useRealTimers());
it('keeps pending content private and publishes only after authorised approval', async () => {
  vi.useFakeTimers(); vi.setSystemTime(now); const env = { DB: testDb(), ADMIN_TOKEN: 'test-secret', ALLOWED_ORIGIN: 'https://spotland.example' };
  const created = await eventApi(make('/api/events', { ...input, status: 'approved' }), env);
  expect(created.status).toBe('pending'); expect(await eventApi(make('/api/events'), env)).toEqual([]);
  await expect(eventApi(make('/api/admin/events'), env)).rejects.toMatchObject({ status: 401 });
  const pending = await eventApi(make('/api/admin/events', undefined, 'test-secret'), env); expect(pending).toHaveLength(1);
  await eventApi(make('/api/admin/events', { id: created.id, status: 'approved' }, 'test-secret'), env);
  expect(await eventApi(make('/api/events'), env)).toMatchObject([{ name: input.name, status: 'approved' }]);
  await expect(eventApi(make('/api/admin/events', { id: created.id, status: 'rejected' }, 'test-secret'), env)).rejects.toMatchObject({ status: 409 });
});
it('rejects invalid dates/coordinates, oversized data, foreign origins and submission floods', async () => {
  vi.useFakeTimers(); vi.setSystemTime(now); const env = { DB: testDb(), ALLOWED_ORIGIN: 'https://spotland.example' };
  expect(() => validateEvent({ ...input, date: '2026-02-30' }, now)).toThrow(); expect(() => validateEvent({ ...input, lat: 0 }, now)).toThrow();
  await expect(eventApi(make('/api/events', input, undefined, 'https://other.example'), env)).rejects.toMatchObject({ status: 403 });
  await expect(eventApi(make('/api/events', { ...input, description: 'x'.repeat(5000) }), env)).rejects.toMatchObject({ status: 413 });
  await expect(eventApi(new Request('https://api.example/api/events', { method: 'POST', headers: { Origin: env.ALLOWED_ORIGIN, 'Content-Type': 'application/json' }, body: 'null' }), env)).rejects.toMatchObject({ status: 400 });
  await eventApi(make('/api/events', input), env); await expect(eventApi(make('/api/events', input), env)).rejects.toMatchObject({ status: 429 });
  vi.setSystemTime(now + 30000); await eventApi(make('/api/events', input), env); vi.setSystemTime(now + 60000); await eventApi(make('/api/events', input), env);
  vi.setSystemTime(now + 90000); await expect(eventApi(make('/api/events', input), env)).rejects.toMatchObject({ status: 429 });
});
it('accepts a Sunday weekend query including Saturday and keeps rejected entries private', async () => {
  vi.useFakeTimers(); vi.setSystemTime(Date.parse('2026-10-04T12:00:00+05:30')); const env = { DB: testDb(), ADMIN_TOKEN: 'test', ALLOWED_ORIGIN: 'https://spotland.example' };
  expect(await eventApi(make('/api/events?start=2026-10-03&end=2026-10-04'), env)).toEqual([]);
  await expect(eventApi(make('/api/events?start=2026-99-99&end=2026-10-04'), env)).rejects.toMatchObject({ status: 400 });
  const created = await eventApi(make('/api/events', { ...input, date: '2026-10-05' }), env); await eventApi(make('/api/admin/events', { id: created.id, status: 'rejected' }, 'test'), env);
  expect(await eventApi(make('/api/events'), env)).toEqual([]);
});
