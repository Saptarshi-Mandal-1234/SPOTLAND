import { API_BASE_URL } from './config';
import type { Point, Route, TravelMode } from '../../shared/routes';
export async function fetchRoute(start: Point, end: Point, mode: TravelMode, signal: AbortSignal): Promise<Route> {
  const query = new URLSearchParams({ startLat: start.lat.toFixed(3), startLon: start.lon.toFixed(3), endLat: end.lat.toFixed(3), endLon: end.lon.toFixed(3), mode });
  const response = await fetch(`${API_BASE_URL}/route?${query}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]) });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Route unavailable. Please retry.'); return data;
}
