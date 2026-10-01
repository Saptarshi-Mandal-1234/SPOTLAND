import { expect, it } from 'vitest';
import { formatDistance, formatDuration, googleMapsLink } from './routes';
it('formats route summaries and encodes Google Maps destinations and modes', () => {
  expect(formatDistance(950)).toBe('950 m'); expect(formatDistance(1300)).toBe('1.3 km');
  expect(formatDuration(61)).toBe('2 min'); expect(formatDuration(3660)).toBe('1 h 1 min');
  const url = new URL(googleMapsLink({ lat: 28, lon: 77 }, 'cycle', { lat: 28.1, lon: 77.1 }));
  expect(url.searchParams.get('destination')).toBe('28,77'); expect(url.searchParams.get('travelmode')).toBe('bicycling'); expect(url.searchParams.get('origin')).toBe('28.1,77.1');
});
