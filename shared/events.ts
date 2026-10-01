import { indiaDate } from './calendar';
export interface EventInput { name: string; date: string; address: string; description: string; lat: number; lon: number }
export interface EventRecord extends EventInput { id: string; status: 'pending' | 'approved' | 'rejected'; created_at: number }
export function validateEvent(value: unknown, now = Date.now()): EventInput {
  const data = value as EventInput;
  const text = (key: 'name' | 'address' | 'description', min: number, max: number) => { const value = data?.[key]; if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new Error(`Check event ${key}.`); return value.trim(); };
  const name = text('name', 3, 100); const address = text('address', 5, 200); const description = text('description', 10, 600);
  if (!data || typeof data.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) throw new Error('Choose a valid event date.');
  const time = Date.parse(`${data.date}T00:00:00Z`); if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== data.date || data.date < indiaDate(now) || data.date > indiaDate(now + 365 * 86400000)) throw new Error('Choose a date within the next year.');
  if (![data.lat, data.lon].every(Number.isFinite) || data.lat < 6 || data.lat > 38 || data.lon < 68 || data.lon > 98) throw new Error('Choose a public venue location in India.');
  return { name, address, description, date: data.date, lat: data.lat, lon: data.lon };
}
