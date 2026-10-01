import { API_BASE_URL } from './config';
import { parseForecast } from '../../shared/weather';
export async function fetchWeather(lat: number, lon: number, signal?: AbortSignal) {
  await Promise.resolve(); signal?.throwIfAborted();
  const response = await fetch(`${API_BASE_URL}/weather?${new URLSearchParams({ lat: String(lat), lon: String(lon) })}`, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000) });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Weather unavailable. Try again.');
  return parseForecast(data);
}
