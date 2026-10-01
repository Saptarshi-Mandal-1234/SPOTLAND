import { API_BASE_URL } from './config';
import type { Place, SearchResult } from '../../shared/places';
async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  await Promise.resolve(); signal?.throwIfAborted();
  const response = await fetch(`${API_BASE_URL}${path}`, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load places. Try again.');
  return data;
}
export const getNearby = (lat: number, lon: number, radius: number, signal?: AbortSignal) => request<Place[]>(`/nearby?${new URLSearchParams({ lat: String(lat), lon: String(lon), radius: String(radius) })}`, signal);
export const searchLocation = (q: string, signal?: AbortSignal) => request<SearchResult[]>(`/search?${new URLSearchParams({ q })}`, signal);
export const getMapConfig = (signal?: AbortSignal) => request<{ tileUrl: string; attribution: string }>('/map-config', signal);
