import { afterEach, expect, it, vi } from 'vitest';
import { getWeather, parseOpenMeteo } from './weather';
import { testDb } from './test-db.js';
afterEach(() => vi.unstubAllGlobals());
const fixture = { hourly: { time: [1790742600, 1790746200], temperature_2m: [25, 26], precipitation_probability: [0, 20], precipitation: [0, .1], wind_speed_10m: [10, 12], weather_code: [0, 2], is_day: [0, 1] } };
it('normalizes Unix timestamps, day/night and rejects missing/null/disordered hourly data', () => {
  expect(parseOpenMeteo(fixture, 123).hours[0]).toMatchObject({ time: 1790742600000, temperature: 25, isDay: false });
  expect(() => parseOpenMeteo({ hourly: { ...fixture.hourly, wind_speed_10m: [10] } })).toThrow();
  expect(() => parseOpenMeteo({ hourly: { ...fixture.hourly, temperature_2m: [null, 26] } })).toThrow();
  expect(() => parseOpenMeteo({ hourly: { ...fixture.hourly, time: [1790742600, 1790742600] } })).toThrow();
  expect(() => parseOpenMeteo({ hourly: { ...fixture.hourly, is_day: [null, 1] } })).toThrow();
});
it('configures units and rounds coordinates, shares cache and throttles cache misses', async () => {
  const mock = vi.fn().mockResolvedValue(Response.json(fixture)); vi.stubGlobal('fetch', mock); const env = { DB: testDb(), OPEN_METEO_URL: 'https://weather.example/forecast' };
  await getWeather(env, 28.614, 77.219); await getWeather(env, 28.611, 77.221);
  expect(mock).toHaveBeenCalledTimes(1); const url = new URL(mock.mock.calls[0][0]);
  expect(url.origin).toBe('https://weather.example'); expect(url.searchParams.get('latitude')).toBe('28.61'); expect(url.searchParams.get('timezone')).toBe('Asia/Kolkata'); expect(url.searchParams.get('timeformat')).toBe('unixtime');
  await expect(getWeather(env, 19.08, 72.88)).rejects.toMatchObject({ status: 429 });
});
it('expires cached forecasts and allows another area after the provider cooldown', async () => {
  const db = testDb(); const mock = vi.fn().mockImplementation(() => Promise.resolve(Response.json(fixture))); vi.stubGlobal('fetch', mock);
  await getWeather({ DB: db }, 28.61, 77.22);
  await db.prepare('UPDATE provider_cache SET expires_at = 0').run(); await db.prepare('UPDATE provider_gates SET next_at = 0').run();
  await getWeather({ DB: db }, 28.61, 77.22); expect(mock).toHaveBeenCalledTimes(2);
});
it('does not cache failed responses and validates coordinates/database', async () => {
  const db = testDb(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
  await expect(getWeather({ DB: db }, 28, 77)).rejects.toMatchObject({ status: 502 });
  expect(await db.prepare('SELECT count(*) AS count FROM provider_cache').first()).toMatchObject({ count: 0 });
  await expect(getWeather({ DB: db }, NaN, 77)).rejects.toMatchObject({ status: 400 });
  await expect(getWeather({}, 28, 77)).rejects.toMatchObject({ status: 503 });
});
