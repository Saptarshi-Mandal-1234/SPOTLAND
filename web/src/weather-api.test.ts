import { afterEach, expect, it, vi } from 'vitest';
import { fetchWeather } from './weather-api';
afterEach(() => vi.unstubAllGlobals());
it('avoids cancelled mount requests before they consume provider quota', async () => {
  const mock = vi.fn(); vi.stubGlobal('fetch', mock); const controller = new AbortController();
  const request = fetchWeather(28, 77, controller.signal); controller.abort();
  await expect(request).rejects.toThrow(); expect(mock).not.toHaveBeenCalled();
});
it('returns validated forecasts and rejects malformed successful responses', async () => {
  const forecast = { fetchedAt: 123, hours: [{ time: 1000, temperature: 25, rainChance: 0, precipitation: 0, wind: 10, code: 0, isDay: true }] };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(forecast))); expect(await fetchWeather(28, 77)).toEqual(forecast);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ hours: [] }))); await expect(fetchWeather(28, 77)).rejects.toThrow('Invalid weather');
});
it('surfaces the provider retry message instead of pretending a forecast exists', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'Wait 18 seconds' }, { status: 429 })));
  await expect(fetchWeather(28, 77)).rejects.toThrow('Wait 18 seconds');
});
