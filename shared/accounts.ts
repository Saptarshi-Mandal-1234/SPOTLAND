import { categories, safetyCategories } from './places';
import { venueKinds, safeWebsite } from './venues';
export interface AccountUser { id: string; name: string }
export interface FavoritePlace { id: string; name: string; category: string; address: string; hours: string; lat?: number; lon?: number; sourceUrl?: string }
export interface FavoriteRecord { place: FavoritePlace; savedAt: number }
export function validateFavorite(value: unknown): FavoritePlace {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid favorite.');
  const data = value as Record<string, unknown>;
  const text = (key: string, max: number, required = false) => { const v = data[key]; if (typeof v !== 'string' || v.length > max || (required && !v.trim())) throw new Error(`Invalid favorite ${key}.`); return v.trim(); };
  const id = text('id', 100, true);
  if (!/^(?:(?:node|way|relation)\/\d+|seed:[a-z0-9-]+|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/.test(id)) throw new Error('Invalid favorite identifier.');
  const category = text('category', 40, true);
  if (![...categories, ...safetyCategories, ...venueKinds].some(v => v === category)) throw new Error('Invalid favorite category.');
  const sourceUrl = data.sourceUrl === undefined ? undefined : safeWebsite(text('sourceUrl', 400));
  if (data.sourceUrl !== undefined && !sourceUrl) throw new Error('Invalid favorite source URL.');
  const place: FavoritePlace = { id, category, name: text('name', 120, true), address: text('address', 300), hours: text('hours', 150), sourceUrl };
  if (data.lat !== undefined || data.lon !== undefined) {
    if (typeof data.lat !== 'number' || typeof data.lon !== 'number' || !Number.isFinite(data.lat) || !Number.isFinite(data.lon) || data.lat < 6 || data.lat > 38 || data.lon < 68 || data.lon > 98) throw new Error('Invalid favorite coordinates.');
    place.lat = data.lat; place.lon = data.lon;
  }
  return place;
}
