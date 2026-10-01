import { afterEach, expect, it, vi } from 'vitest';
import { fetchRoute } from './route-api';
afterEach(() => vi.unstubAllGlobals());
it('rounds coordinates before transmission and reports API failures', async () => {
  const mock = vi.fn().mockResolvedValue(Response.json({ error: 'No route found' }, { status: 404 })); vi.stubGlobal('fetch', mock);
  await expect(fetchRoute({ lat: 28.613999, lon: 77.209123 }, { lat: 28.615123, lon: 77.22 }, 'walk', new AbortController().signal)).rejects.toThrow('No route found');
  expect(mock.mock.calls[0][0]).toContain('startLat=28.614'); expect(mock.mock.calls[0][0]).not.toContain('613999');
});
