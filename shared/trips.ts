import { indiaDate } from './calendar';
import { distanceKm } from './places';
import { travelModes, type TravelMode } from './routes';
import type { Forecast } from './weather';
export const maxTripStops = 8;
export interface TripStop { name: string; address: string; lat: number; lon: number }
export interface TripInput { name: string; date: string; mode: TravelMode; stops: TripStop[] }
export interface SavedTrip extends TripInput { id: string; savedAt: number }
export function validateTrip(value: unknown): TripInput {
  const v = value as TripInput;
  if (!v || typeof v.name !== 'string' || !v.name.trim() || v.name.length > 100 || typeof v.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.date) || !Number.isFinite(Date.parse(v.date)) || new Date(v.date).toISOString().slice(0,10) !== v.date || !travelModes.includes(v.mode)) throw new Error('Enter a trip name, valid date and supported travel mode.');
  if (!Array.isArray(v.stops) || v.stops.length < 2 || v.stops.length > maxTripStops) throw new Error('Choose two to eight stops. The first is your starting point.');
  const stops = v.stops.map(s => {
    if (!s || typeof s.name !== 'string' || !s.name.trim() || s.name.length > 120 || typeof s.address !== 'string' || s.address.length > 300 || typeof s.lat !== 'number' || typeof s.lon !== 'number' || !Number.isFinite(s.lat) || !Number.isFinite(s.lon) || s.lat < 6 || s.lat > 38 || s.lon < 68 || s.lon > 98) throw new Error('Every stop needs a name and coordinates in India.');
    return { name: s.name.trim(), address: s.address.trim(), lat: s.lat, lon: s.lon };
  });
  if (stops.some(s => distanceKm(stops[0],s) > 100)) throw new Error('This pilot supports stops within 100 km of the starting point.');
  if (stops.some((s,i) => i > 0 && s.lat.toFixed(3) === stops[i-1].lat.toFixed(3) && s.lon.toFixed(3) === stops[i-1].lon.toFixed(3))) throw new Error('Consecutive stops are too close for routing. Remove or reorder one.');
  return { name: v.name.trim(), date: v.date, mode: v.mode, stops };
}
export function moveStop(stops: TripStop[], index: number, delta: -1 | 1) {
  const result = [...stops], next = index + delta;
  if (index < 0 || index >= stops.length || next < 0 || next >= stops.length) return result;
  [result[index],result[next]] = [result[next],result[index]]; return result;
}
export function tripDayHours(forecast: Forecast, date: string, now = Date.now()) {
  return forecast.hours.filter(hour => indiaDate(hour.time) === date && hour.time >= now);
}
