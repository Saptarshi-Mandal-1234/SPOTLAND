import { safetyCategories, type Place } from './places';
export function normalizePhone(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const first = value?.split(';')[0].trim();
  if (!first || !/^\+?[\d ()-]+$/.test(first)) return undefined;
  const phone = first.replace(/[ ()-]/g, '');
  return /^\+?\d{3,15}$/.test(phone) ? phone : undefined;
}
export interface SafetySnapshot { center: { lat: number; lon: number }; places: Place[]; savedAt: number }
export function parseSnapshot(value: string | null): SafetySnapshot | null {
  if (!value) return null;
  try {
    const data = JSON.parse(value) as SafetySnapshot;
    if (!data || !Number.isFinite(data.savedAt) || !data.center || !Number.isFinite(data.center.lat) || !Number.isFinite(data.center.lon) || !Array.isArray(data.places) || data.places.some(place => !place || !safetyCategories.includes(place.category as typeof safetyCategories[number]) || !Number.isFinite(place.lat) || !Number.isFinite(place.lon) || typeof place.name !== 'string' || typeof place.id !== 'string' || typeof place.address !== 'string' || typeof place.hours !== 'string')) return null;
    return { ...data, places: data.places.map(place => ({ ...place, phone: normalizePhone(place.phone) })) };
  } catch { return null; }
}
