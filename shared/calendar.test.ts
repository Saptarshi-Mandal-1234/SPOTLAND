import { expect, it } from 'vitest';
import { calendarRange, indiaDate, specialDaysFor, type SpecialDay } from './calendar';
import calendar from '../web/src/special-days.json';
it('uses IST midnight independently of host timezone', () => {
  expect(indiaDate(Date.parse('2026-10-01T18:29:59Z'))).toBe('2026-10-01');
  expect(indiaDate(Date.parse('2026-10-01T18:30:00Z'))).toBe('2026-10-02');
});
it('includes the current Saturday/Sunday and handles a year-crossing weekend', () => {
  expect(calendarRange('weekend', Date.parse('2026-10-04T10:00:00+05:30'))).toEqual({ start: '2026-10-03', end: '2026-10-04' });
  expect(calendarRange('weekend', Date.parse('2027-12-31T10:00:00+05:30'))).toEqual({ start: '2028-01-01', end: '2028-01-02' });
});
it('filters upcoming and exact days without repeating expired yearly dates', () => {
  const days = calendar.days as SpecialDay[];
  expect(specialDaysFor(days, 'today', Date.parse('2026-10-02T12:00:00+05:30')).map(day => day.id)).toEqual(['gandhi-2026']);
  expect(specialDaysFor(days, 'upcoming', Date.parse('2026-09-30T12:00:00+05:30'))).toHaveLength(5);
  expect(specialDaysFor(days, 'upcoming', Date.parse('2027-01-01T12:00:00+05:30'))).toEqual([]);
});
it('keeps curated dates valid and uniquely identified with a source and license', () => {
  expect(new Set(calendar.days.map(day => day.id)).size).toBe(calendar.days.length);
  for (const day of calendar.days) expect(new Date(`${day.date}T00:00:00Z`).toISOString().slice(0, 10)).toBe(day.date);
  expect(calendar.source).toMatch(/^https:\/\/www.indiapost.gov.in\//); expect(calendar.license).toBe('CC0-1.0');
});
