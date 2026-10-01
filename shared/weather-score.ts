import type { WeatherHour } from './weather';
export type Setting = 'indoor' | 'outdoor';
// Planning thresholds, not official warnings: storm codes, >=7.5 mm/h rain, >=35°C heat.
export function weatherAlerts(hour: WeatherHour): string[] {
  return [([95, 96, 99].includes(hour.code) ? 'Thunderstorm forecast' : ''), (hour.precipitation >= 7.5 || [65, 82].includes(hour.code) ? 'Heavy rain forecast' : ''), (hour.temperature >= 35 ? 'Heat forecast (35°C+)' : '')].filter(Boolean);
}
const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
// A conservative subset of OSM hours: 24/7 or day lists/ranges plus HH:MM ranges.
// Complex rules, holidays and unknown hours stay unknown, never assumed open.
export function openingStatus(hours: string, time: number): 'open' | 'closed' | 'unknown' {
  if (hours === '24/7') return 'open';
  const local = new Date(time + 19800000); const day = local.getUTCDay(); const minute = local.getUTCHours() * 60 + local.getUTCMinutes();
  const rules: { days: number[]; ranges: number[][] }[] = [];
  for (const part of hours.split(';')) {
    const match = part.trim().match(/^(?:(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?\s+)?(\d{2}:\d{2}-\d{2}:\d{2}(?:,\s*\d{2}:\d{2}-\d{2}:\d{2})*)$/);
    if (!match) return 'unknown';
    const start = match[1] ? days.indexOf(match[1]) : 0; const end = match[2] ? days.indexOf(match[2]) : start;
    const activeDays = match[1] ? Array.from({ length: (end - start + 7) % 7 + 1 }, (_, index) => (start + index) % 7) : [0, 1, 2, 3, 4, 5, 6];
    const ranges = match[3].split(',').map(range => range.trim().split('-').map(value => { const [h, m] = value.split(':').map(Number); return h > 24 || m > 59 || (h === 24 && m !== 0) ? NaN : h * 60 + m; }));
    if (ranges.some(([a, b]) => !Number.isFinite(a) || !Number.isFinite(b) || a === b || a === 1440)) return 'unknown';
    rules.push({ days: activeDays, ranges });
  }
  return rules.some(rule => rule.ranges.some(([start, end]) => end > start ? rule.days.includes(day) && minute >= start && minute < end : (rule.days.includes(day) && minute >= start) || (rule.days.includes((day + 6) % 7) && minute < end))) ? 'open' : 'closed';
}
// 100-point preference score. Outdoor rain weighs 45 points, indoor 15.
// Comfort band 18–30°C, outdoor wind penalty above 20 km/h; night -8 outdoors.
// Storm/heavy rain travel is excluded; outdoor heat >=35°C/wind >=40 excluded.
export function scoreHour(hour: WeatherHour, hours: string, setting: Setting): number | null {
  if (openingStatus(hours, hour.time) === 'closed' || weatherAlerts(hour).some(alert => !alert.startsWith('Heat')) || hour.temperature >= 40 || (setting === 'outdoor' && (hour.temperature >= 35 || hour.wind >= 40))) return null;
  const discomfort = Math.max(18 - hour.temperature, hour.temperature - 30, 0);
  return Math.max(0, Math.round(100 - hour.rainChance * (setting === 'outdoor' ? .45 : .15) - discomfort * (setting === 'outdoor' ? 3 : 1) - (setting === 'outdoor' ? Math.max(0, hour.wind - 20) + (hour.isDay ? 0 : 8) : 0)));
}
export function bestWindows(forecast: WeatherHour[], hours: string, setting: Setting, now = Date.now()) {
  const candidates = forecast.flatMap((hour, index) => {
    const next = forecast[index + 1]; if (!next || hour.time < now || hour.time + 7200000 > now + 48 * 3600000 || next.time - hour.time !== 3600000) return [];
    const first = scoreHour(hour, hours, setting); const second = scoreHour(next, hours, setting);
    if (first === null || second === null || first < 60 || second < 60) return [];
    // Check the end of both hours, so a visit cannot run beyond closing time.
    if ([hour.time + 3599999, next.time + 3599999].some(time => openingStatus(hours, time) === 'closed')) return [];
    return [{ start: hour.time, end: next.time + 3600000, score: Math.round((first + second) / 2), rainChance: Math.max(hour.rainChance, next.rainChance), temperature: Math.round((hour.temperature + next.temperature) / 2) }];
  }).sort((a, b) => b.score - a.score || a.start - b.start);
  const selected: typeof candidates = [];
  for (const candidate of candidates) { if (selected.every(slot => candidate.end <= slot.start || candidate.start >= slot.end)) selected.push(candidate); if (selected.length === 3) break; }
  return selected;
}
