import { expect, it } from 'vitest';
import { distanceKm, knownOpen, type Place } from './places';
it('calculates distances and does not guess complex opening hours', () => {
  expect(distanceKm({ lat: 28, lon: 77 }, { lat: 28, lon: 77 })).toBe(0);
  expect(distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })).toBeCloseTo(111.19, 1);
  expect(knownOpen({ hours: '24/7' } as Place)).toBe(true);
  expect(knownOpen({ hours: 'Mo-Fr 09:00-17:00' } as Place)).toBe(false);
});
