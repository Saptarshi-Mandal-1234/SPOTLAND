import { validateTrip, type SavedTrip, type TripStop } from '../../shared/trips';
import { hashToken, sessionUser } from './accounts';
import { bodyJson, requireDb, requireOrigin, type EventsEnv } from './events';
import { ProviderError } from './providers';
import type { Database } from './db';
interface TripRow { id: string; name: string; trip_date: string; mode: SavedTrip['mode']; saved_at: number }
async function load(db: Database, row: TripRow): Promise<SavedTrip> {
  const stops = (await db.prepare('SELECT name,address,lat,lon FROM trip_stops WHERE trip_id=? ORDER BY sort_order').bind(row.id).all<TripStop>()).results;
  return { id: row.id, name: row.name, date: row.trip_date, mode: row.mode, savedAt: row.saved_at, stops };
}
export async function tripsApi(request: Request, env: EventsEnv, now = Date.now()) {
  if (!['GET','POST'].includes(request.method)) throw new ProviderError('Method not allowed.',405);
  if (request.method === 'POST') requireOrigin(request,env.ALLOWED_ORIGIN);
  const db = requireDb(env), user = await sessionUser(request,db,now);
  if (!user) throw new ProviderError('Sign in to save or reopen trips. Planning works without login.',401);
  if (request.method === 'GET') {
    const id = new URL(request.url).searchParams.get('id');
    if (id) { const row = await db.prepare('SELECT * FROM trips WHERE id=? AND user_id=?').bind(id,user.id).first<TripRow>(); if (!row) throw new ProviderError('Trip not found in your collection.',404); return load(db,row); }
    return (await db.prepare('SELECT id,name,trip_date AS date,mode,saved_at AS savedAt FROM trips WHERE user_id=? ORDER BY saved_at DESC,id LIMIT 50').bind(user.id).all()).results;
  }
  await db.prepare('DELETE FROM submission_limits WHERE expires_at<=?').bind(now).run();
  const key = await hashToken(`trips:${user.id}:${Math.floor(now/60000)}`);
  if (!await db.prepare('INSERT INTO submission_limits (key,count,next_at,expires_at) VALUES (?,1,0,?) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count<20 RETURNING key').bind(key,now+120000).first()) throw new ProviderError('Too many trip writes. Wait a minute.',429);
  const data = await bodyJson(request,10000);
  if (!data || typeof data.id !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(data.id)) throw new ProviderError('Invalid trip identifier.',400);
  if (data.action === 'remove') { await db.prepare('DELETE FROM trips WHERE id=? AND user_id=?').bind(data.id,user.id).run(); return { removed: true }; }
  if (data.action !== 'save') throw new ProviderError('Invalid trip action.',400);
  let trip; try { trip = validateTrip(data.trip); } catch (e) { throw new ProviderError((e as Error).message,400); }
  if (!db.batch) throw new ProviderError('Atomic trip storage is unavailable.',503);
  const mutation = crypto.randomUUID();
  const statements = [db.prepare('INSERT OR IGNORE INTO trips (id,user_id,name,trip_date,mode,saved_at,mutation_key) SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM trips WHERE user_id=?)<50').bind(data.id,user.id,trip.name,trip.date,trip.mode,now,mutation,user.id)];
  trip.stops.forEach((stop,index) => statements.push(db.prepare('INSERT INTO trip_stops (trip_id,sort_order,name,address,lat,lon) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM trips WHERE id=? AND user_id=? AND mutation_key=?)').bind(data.id,index,stop.name,stop.address,stop.lat,stop.lon,data.id,user.id,mutation)));
  // D1 batch is transactional: a failed stop never leaves a partially saved trip.
  await db.batch(statements);
  const row = await db.prepare('SELECT * FROM trips WHERE id=? AND user_id=?').bind(data.id,user.id).first<TripRow>();
  if (!row) throw new ProviderError('Trip could not be saved. Your 50 slots may be full; remove a saved trip and retry.',409);
  const saved = await load(db,row);
  if (JSON.stringify({name:saved.name,date:saved.date,mode:saved.mode,stops:saved.stops}) !== JSON.stringify(trip)) throw new ProviderError('This save identifier already contains another trip. Save the edited plan as a new trip.',409);
  return saved;
}
