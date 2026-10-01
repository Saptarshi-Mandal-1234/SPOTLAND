export type CalendarFilter = 'today' | 'weekend' | 'upcoming';
export interface SpecialDay { id: string; name: string; date: string; kind: 'holiday' | 'festival'; scope: string }
export function indiaDate(now = Date.now()) { return new Date(now + 19800000).toISOString().slice(0, 10); }
export function calendarRange(filter: CalendarFilter, now = Date.now()) {
  const today = indiaDate(now); const start = new Date(`${today}T00:00:00Z`);
  if (filter === 'today') return { start: today, end: today };
  if (filter === 'upcoming') return { start: today, end: `${today.slice(0, 4)}-12-31` };
  const day = start.getUTCDay(); start.setUTCDate(start.getUTCDate() + (day === 0 ? -1 : (6 - day + 7) % 7));
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
export function specialDaysFor(days: SpecialDay[], filter: CalendarFilter, now = Date.now()) {
  const range = calendarRange(filter, now);
  return days.filter(day => day.date >= range.start && day.date <= range.end).sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}
export const displayDate = (date: string) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T00:00:00+05:30`));
