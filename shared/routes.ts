export const travelModes = ['walk', 'drive', 'cycle'] as const;
export type TravelMode = typeof travelModes[number];
export interface Point { lat: number; lon: number }
export interface Route { distance: number; duration: number; geometry: { type: 'LineString'; coordinates: [number, number][] }; steps: { instruction: string; distance: number }[]; mode: TravelMode }
export function googleMapsLink(destination: Point, mode: TravelMode, origin?: Point) {
  const query = new URLSearchParams({ api: '1', destination: `${destination.lat},${destination.lon}`, travelmode: { walk: 'walking', drive: 'driving', cycle: 'bicycling' }[mode] });
  if (origin) query.set('origin', `${origin.lat},${origin.lon}`);
  return `https://www.google.com/maps/dir/?${query}`;
}
export function formatDistance(meters: number) { return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`; }
export function formatDuration(seconds: number) { const minutes = Math.max(1, Math.ceil(seconds / 60)); return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`; }
