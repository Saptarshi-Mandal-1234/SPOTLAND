import { afterEach, expect, test, vi } from 'vitest';
import { createShare, prepareShareDevice, readShare, stopShare, updateShare } from './live-share-api';
afterEach(() => vi.unstubAllGlobals());
test('recipient secrets travel in headers only; sender writes use cookies, JSON and explicit consent', async () => {
  const fetchMock = vi.fn().mockImplementation(async () => Response.json({ ready: true })); vi.stubGlobal('fetch', fetchMock);
  await readShare('private-token'); expect(fetchMock.mock.calls[0][0]).toBe('/api/live-share'); expect(fetchMock.mock.calls[0][1].headers).toEqual({ Authorization: 'Bearer private-token' }); expect(fetchMock.mock.calls[0][1].credentials).toBe('omit');
  await prepareShareDevice(); expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ consent: true });
  const s = { id: 'test-id', token: 'test-token', expiresAt: 123 }, p = { lat: 28, lon: 77, accuracy: 10 };
  await createShare(s, 4, p); expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ action: 'create', id: s.id, token: s.token, hours: 4, position: p, consent: true }); expect(fetchMock.mock.calls[2][1].credentials).toBe('same-origin');
  await updateShare(s.id, p); expect(JSON.parse(fetchMock.mock.calls[3][1].body).position).toEqual(p);
  await stopShare(s); expect(JSON.parse(fetchMock.mock.calls[4][1].body)).toEqual({ action: 'stop', id: s.id, token: s.token });
});
test('failed stops and reads surface errors; aborted requests do not send', async () => {
  const upstream = vi.fn().mockImplementation(async () => Response.json({ error: 'Sharing unavailable' }, { status: 503 })); vi.stubGlobal('fetch', upstream);
  await expect(stopShare({ id: 'test', token: 'test', expiresAt: 1 })).rejects.toThrow('Sharing unavailable'); await expect(readShare('test')).rejects.toThrow('Sharing unavailable');
  const abort = new AbortController(); abort.abort(); await expect(readShare('test', abort.signal)).rejects.toThrow(); expect(upstream).toHaveBeenCalledTimes(2);
});
