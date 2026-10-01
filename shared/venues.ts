import { normalizePhone } from './safety';
export const venueKinds = ['cinema', 'theatre', 'comedy', 'gaming', 'workshop'] as const;
export type VenueKind = typeof venueKinds[number];
export interface BookingLink { label: string; url: string }
export interface VenueInput { name: string; kind: VenueKind; city: string; address: string; hours: string; phone?: string; website?: string; lat: number; lon: number; price_note: string; booking_links: BookingLink[] }
export interface Venue extends Omit<VenueInput, 'lat' | 'lon'> { id: string; lat?: number; lon?: number; source: 'osm' | 'seed' | 'community'; sourceUrl?: string; directorySourceUrl?: string; price_updated_at: string | null; status: 'pending' | 'approved' | 'rejected' }
export function safeWebsite(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  if (value.length > 400) return undefined;
  try { const url = new URL(value); if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.') || /^(localhost|127\.)/.test(url.hostname)) return undefined; return url.href; } catch { return undefined; }
}
export function validateVenue(value: unknown): VenueInput {
  const data = value as VenueInput;
  function text(key: 'name' | 'city' | 'address' | 'hours' | 'price_note', min: number, max: number) { const value = data?.[key]; if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max || /[\u0000-\u001f]/.test(value)) throw new Error(`Check venue ${key}.`); return value.trim(); }
  const name = text('name', 3, 100); const city = text('city', 2, 80); const address = text('address', 5, 200); const hours = text('hours', 0, 150) || 'Hours not listed'; const price_note = text('price_note', 0, 160);
  if (!venueKinds.includes(data.kind) || ![data.lat, data.lon].every(Number.isFinite) || data.lat < 6 || data.lat > 38 || data.lon < 68 || data.lon > 98) throw new Error('Choose a venue type and public venue coordinates in India.');
  const website = safeWebsite(data.website); if (data.website && !website) throw new Error('Use a public HTTPS website.');
  const phone = normalizePhone(data.phone); if (data.phone && !phone) throw new Error('Check the public venue phone.');
  if (!Array.isArray(data.booking_links) || data.booking_links.length > 3) throw new Error('Add at most three booking links.');
  const booking_links = data.booking_links.map(link => { const url = safeWebsite(link?.url); if (!url || typeof link.label !== 'string' || !link.label.trim() || link.label.length > 40 || /[\u0000-\u001f]/.test(link.label)) throw new Error('Check booking link and label.'); return { url, label: link.label.trim() }; });
  return { name, kind: data.kind, city, address, hours, phone, website, lat: data.lat, lon: data.lon, price_note, booking_links };
}
