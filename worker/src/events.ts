import type { Database } from './db';
import { ProviderError } from './providers';
import { validateEvent, type EventRecord } from '../../shared/events';
import { indiaDate } from '../../shared/calendar';
export interface EventsEnv { DB?: Database; ADMIN_TOKEN?: string; ALLOWED_ORIGIN: string }
export function requireDb(env: { DB?: Database }) { if (!env.DB) throw new ProviderError('Database unavailable.', 503); return env.DB; }
export async function requireAdmin(request: Request, env: EventsEnv) {
  if (!env.ADMIN_TOKEN) throw new ProviderError('Moderation is not configured.', 503);
  const supplied = request.headers.get('Authorization') || '';
  const hash = async (text: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  const [a, b] = await Promise.all([hash(supplied), hash(`Bearer ${env.ADMIN_TOKEN}`)]); let mismatch = 0; for (let i = 0; i < a.length; i++) mismatch |= a[i] ^ b[i];
  if (mismatch) throw new ProviderError('Moderator access required.', 401);
}
export function requireOrigin(request: Request, origin: string) { if (request.headers.get('Origin') !== origin) throw new ProviderError('Request origin not allowed.', 403); }
export async function bodyJson(request: Request, max = 4096) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new ProviderError('Send JSON data.', 415);
  const reader = request.body?.getReader(); if (!reader) throw new ProviderError('Missing data.', 400);
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > max) { await reader.cancel(); throw new ProviderError('Submission too large.', 413); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new ProviderError('Invalid JSON.', 400); }
}
export async function limitSubmission(db: Database, request: Request, scope: string, now = Date.now()) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${scope}:${indiaDate(now)}:${request.headers.get('CF-Connecting-IP') || 'local'}`));
  const key = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
  await db.prepare('DELETE FROM submission_limits WHERE expires_at <= ?').bind(now).run();
  const row = await db.prepare('INSERT INTO submission_limits (key,count,next_at,expires_at) VALUES (?,1,?,?) ON CONFLICT(key) DO UPDATE SET count=count+1,next_at=excluded.next_at WHERE count < 3 AND next_at <= ? RETURNING key').bind(key, now + 30000, now + 86400000, now).first();
  if (!row) throw new ProviderError('Submission limit reached. Wait 30 seconds; maximum three per day.', 429);
}
export async function eventApi(request: Request, env: EventsEnv) {
  const db = requireDb(env); const url = new URL(request.url); const admin = url.pathname === '/api/admin/events';
  if (admin) await requireAdmin(request, env);
  if (request.method === 'GET') {
    if (admin) return (await db.prepare("SELECT * FROM events WHERE status='pending' ORDER BY created_at LIMIT 100").all<EventRecord>()).results;
    const start = url.searchParams.get('start') || indiaDate(); const end = url.searchParams.get('end') || indiaDate(Date.now() + 365 * 86400000);
    const validDate = (date: string) => { const time = Date.parse(`${date}T00:00:00Z`); return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date; };
    if (![start, end].every(validDate) || start > end || start < indiaDate(Date.now() - 7 * 86400000) || end > indiaDate(Date.now() + 366 * 86400000)) throw new ProviderError('Invalid event date range.', 400);
    return (await db.prepare("SELECT * FROM events WHERE status='approved' AND date BETWEEN ? AND ? ORDER BY date,name LIMIT 100").bind(start, end).all<EventRecord>()).results;
  }
  if (request.method !== 'POST') throw new ProviderError('Method not allowed.', 405);
  requireOrigin(request, env.ALLOWED_ORIGIN); const data = await bodyJson(request);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ProviderError('Invalid submission data.', 400);
  if (admin) {
    if (typeof data.id !== 'string' || !['approved', 'rejected'].includes(data.status)) throw new ProviderError('Invalid moderation choice.', 400);
    const row = await db.prepare("UPDATE events SET status=? WHERE id=? AND status='pending' RETURNING id").bind(data.status, data.id).first();
    if (!row) throw new ProviderError('Event no longer pending.', 409); return { status: data.status };
  }
  let event; try { event = validateEvent(data); } catch (error) { throw new ProviderError((error as Error).message, 400); }
  await limitSubmission(db, request, 'events'); const id = crypto.randomUUID();
  await db.prepare("INSERT INTO events (id,name,date,address,description,lat,lon,status,created_at) VALUES (?,?,?,?,?,?,?,'pending',?)").bind(id, event.name, event.date, event.address, event.description, event.lat, event.lon, Date.now()).run();
  return { id, status: 'pending' };
}
