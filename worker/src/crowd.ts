import { estimateCrowd, type CrowdReport } from '../../shared/crowd';
import { indiaDate } from '../../shared/calendar';
import { bodyJson, limitSubmission, requireDb, requireOrigin, type EventsEnv } from './events';
import { ProviderError } from './providers';
export async function crowdApi(request: Request, env: EventsEnv) {
  const db = requireDb(env); const now = Date.now();
  if (!['GET', 'POST'].includes(request.method)) throw new ProviderError('Method not allowed.', 405);
  if (request.method === 'POST') requireOrigin(request, env.ALLOWED_ORIGIN);
  const input = request.method === 'POST' ? await bodyJson(request, 512) : { placeId: new URL(request.url).searchParams.get('placeId') };
  if (!input || typeof input !== 'object' || typeof input.placeId !== 'string' || !/^((node|way|relation)\/\d{1,16}|seed:[a-z-]{1,50}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/.test(input.placeId)) throw new ProviderError('Invalid place.', 400);
  await db.prepare('DELETE FROM crowd_reports WHERE created_at <= ?').bind(now - 90 * 86400000).run();
  if (request.method === 'POST') {
    if (!['quiet', 'moderate', 'busy'].includes(input.level)) throw new ProviderError('Choose Quiet, Moderate or Busy.', 400);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${indiaDate(now)}:${request.headers.get('CF-Connecting-IP') || 'local'}`));
    const key = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
    if (await db.prepare('SELECT place_id FROM crowd_reports WHERE place_id=? AND reporter_day=?').bind(input.placeId, key).first()) throw new ProviderError('Already reported here today from this network.', 429);
    await limitSubmission(db, request, 'crowd', now);
    const inserted = await db.prepare('INSERT OR IGNORE INTO crowd_reports (place_id,reporter_day,level,created_at) VALUES (?,?,?,?) RETURNING place_id').bind(input.placeId, key, input.level, now).first();
    if (!inserted) throw new ProviderError('Already reported here today from this network.', 429);
  }
  const rows = await db.prepare('SELECT level,created_at FROM crowd_reports WHERE place_id=? ORDER BY created_at DESC LIMIT 5000').bind(input.placeId).all<CrowdReport>();
  return estimateCrowd(rows.results, now);
}
