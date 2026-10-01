import { parseForecast, type WeatherHour } from '../../shared/weather';
import { readCache, reserveProvider, writeCache, type Database } from './db';
import { ProviderError } from './providers';
export interface WeatherEnv { DB?: Database; OPEN_METEO_URL?: string }
export function parseOpenMeteo(data: unknown, now = Date.now()) {
  const hourly = (data as { hourly?: Record<string, unknown[]> })?.hourly;
  const keys = ['time', 'temperature_2m', 'precipitation_probability', 'precipitation', 'wind_speed_10m', 'weather_code', 'is_day'];
  if (!hourly || keys.some(key => !Array.isArray(hourly[key]) || hourly[key].length !== hourly.time?.length)) throw new ProviderError('Incomplete weather data. Try again later.');
  const hours: WeatherHour[] = hourly.time.map((time, index) => ({ time: typeof time === 'number' ? time * 1000 : NaN, temperature: hourly.temperature_2m[index] as number, rainChance: hourly.precipitation_probability[index] as number, precipitation: hourly.precipitation[index] as number, wind: hourly.wind_speed_10m[index] as number, code: hourly.weather_code[index] as number, isDay: hourly.is_day[index] === 1 }));
  if (hourly.is_day.some(value => value !== 0 && value !== 1)) throw new ProviderError('Incomplete weather data. Try again later.');
  try { return parseForecast({ fetchedAt: now, hours }); } catch { throw new ProviderError('Incomplete weather data. Try again later.'); }
}
export async function getWeather(env: WeatherEnv, lat: number, lon: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 6 || lat > 38 || lon < 68 || lon > 98) throw new ProviderError('Choose a weather location in India.', 400);
  if (!env.DB) throw new ProviderError('Weather needs the configured D1 database.', 503);
  const endpoint = env.OPEN_METEO_URL || 'https://api.open-meteo.com/v1/forecast';
  const latitude = lat.toFixed(2); const longitude = lon.toFixed(2); const key = `weather:${endpoint}:${latitude}:${longitude}`;
  const hit = await readCache(env.DB, key); if (hit !== null) return parseForecast(hit);
  // At most 4,800 misses/day globally: safely below free non-commercial limits.
  if (!await reserveProvider(env.DB, 'open-meteo', 18000)) throw new ProviderError('Weather provider is busy. Wait 18 seconds and retry.', 429);
  const url = new URL(endpoint); url.search = new URLSearchParams({ latitude, longitude, hourly: 'temperature_2m,precipitation_probability,precipitation,wind_speed_10m,weather_code,is_day', timezone: 'Asia/Kolkata', timeformat: 'unixtime', forecast_days: '3', temperature_unit: 'celsius', wind_speed_unit: 'kmh', precipitation_unit: 'mm' }).toString();
  let response: Response;
  try { response = await fetch(url, { signal: AbortSignal.timeout(25000) }); } catch { throw new ProviderError('Weather provider unavailable. Try again later.'); }
  if (!response.ok) throw new ProviderError('Weather provider unavailable. Try again later.', response.status === 429 ? 429 : 502);
  const result = parseOpenMeteo(await response.json()); await writeCache(env.DB, key, result, 30 * 60000); return result;
}
