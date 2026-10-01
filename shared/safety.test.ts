import { expect, it } from 'vitest';
import { normalizePhone, parseSnapshot } from './safety';
it('normalizes phone numbers and rejects unsafe telephone URIs', () => {
  expect(normalizePhone(123456)).toBeUndefined(); expect(normalizePhone(null)).toBeUndefined();
  expect(normalizePhone('+91 (11) 2345-6789; +91 1234567890')).toBe('+911123456789');
  expect(normalizePhone('javascript:alert(1)')).toBeUndefined(); expect(normalizePhone('123#*')).toBeUndefined();
});
it('restores valid cached safety places and rejects corrupt or unrelated data', () => {
  const snapshot = { savedAt: 1000, center: { lat: 28, lon: 77 }, places: [{ id: 'node/1', name: 'Hospital', category: 'hospital', lat: 28, lon: 77, address: 'Road', hours: '24/7', phone: '+91 1234567890' }] };
  expect(parseSnapshot(JSON.stringify(snapshot))?.places[0].phone).toBe('+911234567890');
  expect(parseSnapshot('{broken')).toBeNull(); expect(parseSnapshot(JSON.stringify({ ...snapshot, places: [{ ...snapshot.places[0], category: 'cafe' }] }))).toBeNull();
});
