export const categories = ['cafe', 'restaurant', 'attraction', 'park', 'museum', 'temple', 'viewpoint', 'shopping', 'gaming'] as const;
export const categoryLabel = (category: string) => category === 'shopping' ? 'Shopping malls & centres' : category === 'gaming' ? 'Gaming & internet cafes' : category;
export const safetyCategories = ['police', 'hospital', 'pharmacy', 'clinic', 'doctors', 'fire_station'] as const;
export type SafetyCategory = typeof safetyCategories[number];
export type Category = typeof categories[number] | SafetyCategory;
export interface Place { id: string; name: string; category: Category; lat: number; lon: number; address: string; hours: string; rating?: number; phone?: string }
export interface SearchResult { name: string; lat: number; lon: number; state: string }
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = Math.PI / 180;
  const x = Math.sin((b.lat - a.lat) * rad / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lon - a.lon) * rad / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
// Only an unambiguous all-day schedule is treated as open; complex OSM hours are shown verbatim.
export function knownOpen(place: Place) { return place.hours.trim() === '24/7'; }
