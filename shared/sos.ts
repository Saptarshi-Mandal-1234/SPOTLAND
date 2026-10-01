import { distanceKm } from './places';
import { validateSharePosition } from './live-share';
export const sosRadiusKm = 2, sosLifetime = 3600000, nearbyLifetime = 3600000, reportThreshold = 3;
const alphabet = '0123456789bcdefghjkmnpqrstuvwxyz';
export interface EmergencyContact { name: string; phone: string }
export interface NearbyAlert { id: string; geohash: string; createdAt: number; expiresAt: number; distanceKm: number; direction: string }
export interface SosReceipt { id: string; status: 'active' | 'safe' | 'hidden'; expiresAt: number; push: { sent: number; pending: number; failed: number; eligible: number } }
export function encodeArea(lat: number, lon: number) {
  validateSharePosition({ lat, lon, accuracy: 0 });
  const latitude = [-90,90], longitude = [-180,180]; let hash = '', bits = 0, value = 0;
  for (let n = 0; n < 30; n++) { const range = n % 2 === 0 ? longitude : latitude, coord = n % 2 === 0 ? lon : lat, mid = (range[0] + range[1]) / 2; const bit = coord >= mid ? 1 : 0; range[bit ? 0 : 1] = mid; value = (value << 1) | bit; if (++bits === 5) { hash += alphabet[value]; bits = 0; value = 0; } }
  return hash;
}
export function decodeArea(hash: unknown) {
  if (typeof hash !== 'string' || !/^[0-9bcdefghjkmnpqrstuvwxyz]{6}$/.test(hash)) throw new Error('Choose a valid approximate area in India.');
  const latitude = [-90,90], longitude = [-180,180]; let n = 0;
  for (const char of hash) { const value = alphabet.indexOf(char); for (let bit = 4; bit >= 0; bit--) { const range = n++ % 2 === 0 ? longitude : latitude; range[(value >> bit) & 1 ? 0 : 1] = (range[0] + range[1]) / 2; } }
  const lat = (latitude[0] + latitude[1]) / 2, lon = (longitude[0] + longitude[1]) / 2; validateSharePosition({ lat, lon, accuracy: 0 });
  return { lat, lon, height: latitude[1] - latitude[0], width: longitude[1] - longitude[0] };
}
export function nearbyHashes(hash: string) {
  const center = decodeArea(hash), hashes: string[] = [];
  for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) { try { hashes.push(encodeArea(center.lat + y * center.height, center.lon + x * center.width)); } catch { /* Outside India. */ } }
  return hashes;
}
export function approximateDistance(from: string, to: string) { return distanceKm(decodeArea(from), decodeArea(to)); }
export function approximateDirection(from: string, to: string) {
  const a = decodeArea(from), b = decodeArea(to); if (distanceKm(a,b) < .15) return 'same approximate area';
  const rad = Math.PI / 180, delta = (b.lon - a.lon) * rad;
  const bearing = (Math.atan2(Math.sin(delta) * Math.cos(b.lat * rad), Math.cos(a.lat * rad) * Math.sin(b.lat * rad) - Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos(delta)) / rad + 360) % 360;
  return ['N','NE','E','SE','S','SW','W','NW'][Math.round(bearing / 45) % 8];
}
export function contactList(value: unknown): EmergencyContact[] {
  if (!Array.isArray(value) || value.length > 5) throw new Error('Keep up to five emergency contacts.');
  const seen = new Set<string>(); return value.map(c => { if (!c || typeof c.name !== 'string' || !c.name.trim() || c.name.length > 60 || typeof c.phone !== 'string' || !/^\+?[\d ()-]{7,25}$/.test(c.phone)) throw new Error('Enter a name and a valid phone number.'); const phone = c.phone.replace(/[ ()-]/g, ''); if (!/^\+?\d{7,15}$/.test(phone) || seen.has(phone.replace(/^\+/, ''))) throw new Error('Use valid, unique contact numbers.'); seen.add(phone.replace(/^\+/, '')); return { name: c.name.trim(), phone }; });
}
export function sosSms(contacts: EmergencyContact[], link: string, ios = false) { return `sms:${contactList(contacts).map(c => c.phone).join(',')}${ios ? '&' : '?'}body=${encodeURIComponent(`I need help. Please call me or Call 112. My SPOTLAND location (updates only while app is open): ${link}`)}`; }
