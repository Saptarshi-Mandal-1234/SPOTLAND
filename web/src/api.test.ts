import { afterEach, expect, it, vi } from 'vitest';
import { checkHealth } from './api';
afterEach(() => vi.unstubAllGlobals());
it('accepts a valid API health response', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ status: 'ok' })));
  await expect(checkHealth()).resolves.toBe('Connected');
});
it('reports unavailable and malformed API responses', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
  await expect(checkHealth()).rejects.toThrow('API unavailable');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ status: 'wrong' })));
  await expect(checkHealth()).rejects.toThrow('Unexpected API response');
});
