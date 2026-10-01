import { reviewPlaceId, validateReview, type Review, type ReviewList } from '../../shared/reviews';
import { sessionUser } from './accounts';
import { bodyJson, requireAdmin, requireDb, requireOrigin } from './events';
import { ProviderError } from './providers';
import { reviewLimit } from './review-limits';
import { attachReviewPhotos, ownPhotos, removeReviewPhotos, type ReviewPhotoEnv } from './review-photos';
const fields = 'id,rating,text,created_at AS createdAt,updated_at AS updatedAt';
export async function reviewsApi(request: Request, env: ReviewPhotoEnv, now = Date.now()) {
  const db = requireDb(env); const url = new URL(request.url); const admin = url.pathname === '/api/admin/reviews';
  if (!['GET','POST'].includes(request.method)) throw new ProviderError('Method not allowed.',405);
  if (admin) await requireAdmin(request,env);
  if (request.method === 'POST') requireOrigin(request,env.ALLOWED_ORIGIN);
  if (admin) {
    if (request.method === 'GET') return (await db.prepare(`SELECT ${fields},place_id AS placeId,status,(SELECT COUNT(*) FROM review_reports WHERE review_id=reviews.id) AS reports FROM reviews ORDER BY updated_at DESC,id LIMIT 50`).all()).results;
    const data = await bodyJson(request);
    if (!data || data.action !== 'hide' || typeof data.id !== 'string') throw new ProviderError('Invalid moderation request.',400);
    const row = await db.prepare("UPDATE reviews SET status='hidden',updated_at=? WHERE id=? RETURNING id").bind(now,data.id).first();
    if (row) await db.prepare("UPDATE review_photos SET status='hidden' WHERE review_id=? AND status IN ('pending','approved')").bind(data.id).run();
    if (!row) throw new ProviderError('Review not found.',404); return { hidden: true };
  }
  const user = await sessionUser(request,db,now);
  if (request.method === 'GET') {
    let placeId; try { placeId = reviewPlaceId(url.searchParams.get('placeId')); } catch (e) { throw new ProviderError((e as Error).message,400); }
    const reviewRows = (await db.prepare(`SELECT ${fields} FROM reviews WHERE place_id=? AND status='visible' ORDER BY created_at DESC,id LIMIT 20`).bind(placeId).all<Review>()).results;
    const reviews = await attachReviewPhotos(db,reviewRows);
    const stats = await db.prepare("SELECT COUNT(*) AS count,ROUND(AVG(rating),1) AS average FROM reviews WHERE place_id=? AND status='visible'").bind(placeId).first<{count:number;average:number|null}>();
    const mineRow = user ? await db.prepare(`SELECT ${fields},status FROM reviews WHERE place_id=? AND user_id=?`).bind(placeId,user.id).first<Omit<NonNullable<ReviewList['mine']>,'photos'>>() : null;
    const mine = mineRow ? {...mineRow,photos:await ownPhotos(db,mineRow.id,user!.id)} : null;
    return { reviews, count: stats?.count ?? 0, average: stats?.average ?? null, mine } satisfies ReviewList;
  }
  if (!user) throw new ProviderError('Sign in to post or report reviews. Reading needs no login.',401);
  const data = await bodyJson(request,6000);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ProviderError('Invalid review request.',400);
  if (data.action === 'save') {
    let review; try { review = validateReview(data); } catch (e) { throw new ProviderError((e as Error).message,400); }
    const existing = await db.prepare('SELECT id,rating,text,status FROM reviews WHERE user_id=? AND place_id=?').bind(user.id,review.placeId).first<{id:string;rating:number;text:string;status:string}>();
    if (existing?.status === 'hidden') throw new ProviderError('This review is hidden for moderation and cannot be edited.',409);
    if (existing?.rating === review.rating && existing.text === review.text) return { id: existing.id, saved: true };
    await reviewLimit(db,user.id,'publish',10,30000,now); await reviewLimit(db,request.headers.get('CF-Connecting-IP') || 'local','network-publish',50,0,now);
    const row = await db.prepare("INSERT INTO reviews (id,user_id,place_id,rating,text,created_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(user_id,place_id) DO UPDATE SET rating=excluded.rating,text=excluded.text,updated_at=excluded.updated_at WHERE reviews.status='visible' RETURNING id").bind(crypto.randomUUID(),user.id,review.placeId,review.rating,review.text,now,now).first<{id:string}>();
    if (!row) throw new ProviderError('Review changed during submission. Reload before retrying.',409); return { id: row.id, saved: true };
  }
  if (!['remove','report'].includes(data.action) || typeof data.id !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(data.id)) throw new ProviderError('Invalid review action.',400);
  if (data.action === 'remove') {
    const owned = await db.prepare('SELECT id FROM reviews WHERE id=? AND user_id=?').bind(data.id,user.id).first();
    if (!owned) return { removed: true };
    await reviewLimit(db,user.id,'remove',30,0,now);
    await removeReviewPhotos(env,data.id);
    await db.prepare('DELETE FROM reviews WHERE id=? AND user_id=?').bind(data.id,user.id).run(); return { removed: true };
  }
  const target = await db.prepare('SELECT user_id,status FROM reviews WHERE id=?').bind(data.id).first<{user_id:string;status:string}>();
  if (!target || target.status !== 'visible') return { reported: true };
  if (target.user_id === user.id) throw new ProviderError('Remove your own review instead of reporting it.',400);
  const reported = await db.prepare('SELECT review_id FROM review_reports WHERE review_id=? AND user_id=?').bind(data.id,user.id).first();
  if (reported) return { reported: true };
  await reviewLimit(db,user.id,'report',20,0,now);
  await reviewLimit(db,request.headers.get('CF-Connecting-IP') || 'local','network-report',100,0,now);
  if (!db.batch) throw new ProviderError('Review reporting unavailable. Retry shortly.',503);
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO review_reports (review_id,user_id,created_at) VALUES (?,?,?)').bind(data.id,user.id,now),
    db.prepare("UPDATE reviews SET status='hidden',updated_at=? WHERE id=? AND (SELECT COUNT(*) FROM review_reports WHERE review_id=?)>=3").bind(now,data.id,data.id),
    db.prepare("UPDATE review_photos SET status='hidden' WHERE review_id=? AND (SELECT status FROM reviews WHERE id=?)='hidden' AND status IN ('pending','approved')").bind(data.id,data.id),
  ]);
  return { reported: true };
}
