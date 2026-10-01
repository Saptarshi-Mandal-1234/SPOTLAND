import { expect, it } from 'vitest';
import { bestWindows, openingStatus, scoreHour, weatherAlerts } from './weather-score';
import type { WeatherHour } from './weather';
const time = Date.parse('2026-09-30T10:00:00+05:30');
const hour: WeatherHour = { time, temperature: 25, rainChance: 0, precipitation: 0, wind: 10, code: 0, isDay: true };
it('scores comfortable dry hours higher, adjusts for indoor rain and outdoor night', () => {
  expect(scoreHour(hour, '24/7', 'outdoor')).toBe(100);
  expect(scoreHour({ ...hour, rainChance: 80 }, '24/7', 'outdoor')).toBe(64);
  expect(scoreHour({ ...hour, rainChance: 80 }, '24/7', 'indoor')).toBe(88);
  expect(scoreHour({ ...hour, isDay: false }, '24/7', 'outdoor')).toBe(92);
  expect(scoreHour({ ...hour, temperature: 34, wind: 30 }, '24/7', 'outdoor')).toBe(78);
});
it('excludes storms, heavy rain, outdoor heat/wind and closed hours', () => {
  for (const patch of [{ code: 95 }, { precipitation: 7.5 }, { temperature: 35 }, { wind: 40 }]) expect(scoreHour({ ...hour, ...patch }, '24/7', 'outdoor')).toBeNull();
  expect(scoreHour({ ...hour, code: 99 }, '24/7', 'indoor')).toBeNull();
  expect(scoreHour({ ...hour, temperature: 36 }, '24/7', 'indoor')).not.toBeNull();
  expect(scoreHour(hour, '11:00-18:00', 'indoor')).toBeNull();
  expect(weatherAlerts({ ...hour, code: 95, precipitation: 10, temperature: 35 })).toHaveLength(3);
});
it('handles IST weekdays, multiple ranges, end boundaries and overnight carryover', () => {
  expect(openingStatus('Mo-Fr 09:00-17:00', time)).toBe('open');
  expect(openingStatus('Sa-Su 09:00-17:00', time)).toBe('closed');
  expect(openingStatus('09:00-10:00,12:00-13:00', time)).toBe('closed');
  expect(openingStatus('We 22:00-02:00', Date.parse('2026-10-01T01:00:00+05:30'))).toBe('open');
  expect(openingStatus('We 22:00-02:00', Date.parse('2026-09-30T01:00:00+05:30'))).toBe('closed');
  expect(openingStatus('22:00-24:00', Date.parse('2026-09-30T23:00:00+05:30'))).toBe('open');
});
it('leaves unknown, holiday, invalid or complex schedules unverified', () => {
  for (const schedule of ['Hours not listed', 'Mo-Fr 09:00-17:00; PH off', '09:99-17:00', '25:00-26:00', 'sunrise-sunset', '00:00-00:00']) expect(openingStatus(schedule, time)).toBe('unknown');
});
it('returns three non-overlapping two-hour windows and excludes past hours', () => {
  const hours = Array.from({ length: 10 }, (_, index) => ({ ...hour, time: time + index * 3600000 }));
  const windows = bestWindows(hours, '24/7', 'outdoor', time);
  expect(windows.map(window => window.start)).toEqual([time, time + 7200000, time + 14400000]);
  expect(bestWindows(hours, '24/7', 'outdoor', time + 1)[0].start).toBe(time + 3600000);
  expect(bestWindows(hours.map(value => ({ ...value, code: 95 })), '24/7', 'outdoor', time)).toEqual([]);
});
it('requires complete windows within opening hours and rejects gaps', () => {
  const hours = [hour, { ...hour, time: time + 3600000 }, { ...hour, time: time + 7200000 }];
  expect(bestWindows(hours, '10:00-11:30', 'outdoor', time)).toEqual([]);
  expect(bestWindows(hours, '10:00-12:00', 'outdoor', time)).toHaveLength(1);
  expect(bestWindows([hours[0], hours[2]], '24/7', 'outdoor', time)).toEqual([]);
});
