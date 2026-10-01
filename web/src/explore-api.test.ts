import { afterEach, expect, it, vi } from 'vitest';
import { getNearby, searchLocation } from './explore-api';
afterEach(() => vi.unstubAllGlobals());
it('does not send cancelled mount requests to a rate-limited provider', async () => {
  const mock = vi.fn(); vi.stubGlobal('fetch', mock); const controller = new AbortController();
  const request = getNearby(28.6, 77.2, 2000, controller.signal); controller.abort();
  await expect(request).rejects.toThrow(); expect(mock).not.toHaveBeenCalled();
});
it('encodes submitted searches and nearby coordinates', async () => {
  const mock = vi.fn().mockImplementation(() => Promise.resolve(Response.json([]))); vi.stubGlobal('fetch', mock);
  await searchLocation('India Gate & park'); expect(mock.mock.calls[0][0]).toContain('q=India+Gate+%26+park');
  await getNearby(28.6, 77.2, 2000); expect(mock.mock.calls[1][0]).toContain('radius=2000');
});
it('shows provider error messages to the user', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'Provider is busy.' }, { status: 429 })));
  await expect(searchLocation('Delhi')).rejects.toThrow('Provider is busy.');
});

