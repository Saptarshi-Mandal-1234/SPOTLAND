import { sessionUser } from './accounts';
import { bodyJson, requireAdmin, requireDb, requireOrigin, type EventsEnv } from './events';
import { reviewLimit } from './review-limits';
import { ProviderError } from './providers';
import type { Database } from './db';
import type { Review, ReviewPhoto } from '../../shared/reviews';

interface ReviewPhotoObject { readonly body: ReadableStream; readonly size: number; readonly httpEtag: string }
interface ReviewPhotoBucket {
  put(key:string,value:ArrayBufferView,options?:{httpMetadata?:{contentType?:string;cacheControl?:string};customMetadata?:Record<string,string>}):Promise<unknown>;
  get(key:string):Promise<ReviewPhotoObject|null>;
  delete(keys:string|string[]):Promise<void>;
}
export interface ReviewPhotoEnv extends EventsEnv { REVIEW_PHOTOS?: ReviewPhotoBucket }
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const MAX_FORM_BYTES = MAX_PHOTO_BYTES + 64 * 1024;
const MAX_STORED_BYTES = 8 * 1024 * 1024 * 1024;
const PUBLIC_PHOTO_PATH = '/api/review-photos/';
const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id);
interface PhotoRow { id: string; review_id: string; owner_user_id: string; object_key: string; content_type: string; size_bytes: number; status: ReviewPhoto['status'] | 'uploading'; created_at: number; slot: number }
interface BudgetRow { bytes_used: number }

function bucket(env: ReviewPhotoEnv) {
  if (!env.REVIEW_PHOTOS) throw new ProviderError('Photo storage is not configured. Try again later.',503);
  return env.REVIEW_PHOTOS;
}
function jpegIsMetadataFree(data: Uint8Array) {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8 || data[data.length-2] !== 0xff || data[data.length-1] !== 0xd9) return false;
  let offset = 2;
  while (offset < data.length) {
    if (data[offset] !== 0xff) return false;
    while (data[offset] === 0xff) offset++;
    const marker = data[offset++];
    if (marker === 0xda) return offset < data.length; // The browser re-encodes the pixels; metadata is before the scan.
    if (marker === 0xd9) return false;
    if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 1 >= data.length) return false;
    const length = (data[offset] << 8) | data[offset + 1];
    if (length < 2 || offset + length > data.length) return false;
    if ([0xe1,0xe2,0xed,0xfe].includes(marker)) return false;
    offset += length;
  }
  return false;
}
async function boundedMultipart(request: Request) {
  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data;')) throw new ProviderError('Send one compressed JPEG photo.',415);
  const declared = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > MAX_FORM_BYTES) throw new ProviderError('Photo is too large. Keep it under 3 MB after compression.',413);
  const reader = request.body?.getReader(); if (!reader) throw new ProviderError('Choose a photo to upload.',400);
  const chunks: Uint8Array[] = []; let total = 0;
  while (true) {
    const { done,value } = await reader.read(); if (done) break;
    total += value.byteLength;
    if (total > MAX_FORM_BYTES) { await reader.cancel(); throw new ProviderError('Photo is too large. Keep it under 3 MB after compression.',413); }
    chunks.push(value);
  }
  const data = new Uint8Array(total); let cursor = 0;
  for (const chunk of chunks) { data.set(chunk,cursor); cursor += chunk.byteLength; }
  try { return await new Request('https://spotland.invalid/upload',{ method:'POST',headers:{'Content-Type':contentType},body:data }).formData(); }
  catch { throw new ProviderError('That photo upload could not be read. Try another JPEG.',400); }
}
function photoRowsToPublic(rows: PhotoRow[]): ReviewPhoto[] {
  return rows.filter(row => row.status === 'approved').map(row => ({ id:row.id,status:'approved',url:`${PUBLIC_PHOTO_PATH}${row.id}` }));
}
export async function attachReviewPhotos(db: Database, reviews: Review[]) {
  if (!reviews.length) return reviews;
  const ids = reviews.map(review => review.id);
  const photos = (await db.prepare(`SELECT id,review_id,owner_user_id,object_key,content_type,size_bytes,status,created_at,slot FROM review_photos WHERE review_id IN (${ids.map(()=>'?').join(',')}) AND status='approved' ORDER BY slot`).bind(...ids).all<PhotoRow>()).results;
  const byReview = new Map<string,PhotoRow[]>();
  for (const photo of photos) { const list = byReview.get(photo.review_id) || []; list.push(photo); byReview.set(photo.review_id,list); }
  return reviews.map(review => ({...review,photos:photoRowsToPublic(byReview.get(review.id) || [])}));
}
export async function ownPhotos(db: Database, reviewId: string, userId: string): Promise<ReviewPhoto[]> {
  const rows = (await db.prepare("SELECT id,review_id,owner_user_id,object_key,content_type,size_bytes,status,created_at,slot FROM review_photos WHERE review_id=? AND owner_user_id=? AND status!='uploading' ORDER BY slot").bind(reviewId,userId).all<PhotoRow>()).results;
  return rows.flatMap(row => row.status==='uploading' ? [] : [{id:row.id,status:row.status,url:row.status === 'approved' ? `${PUBLIC_PHOTO_PATH}${row.id}` : undefined}]);
}
export async function removeReviewPhotos(env: ReviewPhotoEnv, reviewId: string) {
  const db = requireDb(env);
  const photos = (await db.prepare('SELECT object_key,size_bytes FROM review_photos WHERE review_id=?').bind(reviewId).all<{object_key:string;size_bytes:number}>()).results;
  if (!photos.length) return;
  const store = bucket(env);
  await store.delete(photos.map(photo=>photo.object_key));
  await db.prepare('DELETE FROM review_photos WHERE review_id=?').bind(reviewId).run();
  await db.prepare('UPDATE review_photo_storage_budget SET bytes_used=MAX(0,bytes_used-?) WHERE singleton=1').bind(photos.reduce((sum,photo)=>sum+photo.size_bytes,0)).run();
}
async function removeOne(db: Database, store: ReviewPhotoBucket, photo: PhotoRow) {
  await store.delete(photo.object_key);
  await db.prepare('DELETE FROM review_photos WHERE id=?').bind(photo.id).run();
  await db.prepare('UPDATE review_photo_storage_budget SET bytes_used=MAX(0,bytes_used-?) WHERE singleton=1').bind(photo.size_bytes).run();
}
async function reserveSlot(db: Database, photoId: string, reviewId: string, ownerId: string, key: string, size: number, now: number) {
  return db.prepare(`INSERT INTO review_photos (id,review_id,owner_user_id,object_key,content_type,size_bytes,status,created_at,slot)
    SELECT ?,r.id,?,?, 'image/jpeg',?,'uploading',?,CASE WHEN NOT EXISTS(SELECT 1 FROM review_photos WHERE review_id=r.id AND slot=0) THEN 0 WHEN NOT EXISTS(SELECT 1 FROM review_photos WHERE review_id=r.id AND slot=1) THEN 1 ELSE 2 END
    FROM reviews r WHERE r.id=? AND r.user_id=? AND r.status='visible' AND (SELECT COUNT(*) FROM review_photos WHERE review_id=r.id)<3 RETURNING id`).bind(photoId,ownerId,key,size,now,reviewId,ownerId).first<{id:string}>();
}
async function uploadPhoto(request: Request, env: ReviewPhotoEnv, now: number) {
  requireOrigin(request,env.ALLOWED_ORIGIN);
  const db = requireDb(env), store = bucket(env), user = await sessionUser(request,db,now);
  if (!user) throw new ProviderError('Sign in and save a review before adding a photo.',401);
  const form = await boundedMultipart(request), reviewId = form.get('reviewId'), file = form.get('photo');
  if (typeof reviewId !== 'string' || !validId(reviewId) || !(file instanceof File) || form.getAll('photo').length !== 1 || [...form.keys()].some(key=>key!=='reviewId'&&key!=='photo')) throw new ProviderError('Choose one JPEG photo for your saved review.',400);
  if (file.type !== 'image/jpeg') throw new ProviderError('Photo must be converted to JPEG before upload.',415);
  if (file.size < 1 || file.size > MAX_PHOTO_BYTES) throw new ProviderError('Photo must be under 3 MB after compression.',413);
  const data = new Uint8Array(await file.arrayBuffer());
  if (!jpegIsMetadataFree(data)) throw new ProviderError('That photo is not a clean JPEG. Re-select it so SPOTLAND can remove location metadata.',400);
  const parent = await db.prepare("SELECT id FROM reviews WHERE id=? AND user_id=? AND status='visible'").bind(reviewId,user.id).first();
  if (!parent) throw new ProviderError('Save a visible review first. Each review can have up to three photos.',409);
  const photoCount = await db.prepare('SELECT COUNT(*) AS count FROM review_photos WHERE review_id=?').bind(reviewId).first<{count:number}>();
  if ((photoCount?.count || 0) >= 3) throw new ProviderError('This review already has three photos.',409);
  await reviewLimit(db,user.id,'photo-upload',8,15000,now);
  await reviewLimit(db,request.headers.get('CF-Connecting-IP') || 'local','photo-network',50,0,now);
  const id = crypto.randomUUID(), key = `reviews/${reviewId}/${id}.jpg`;
  const reserved = await reserveSlot(db,id,reviewId,user.id,key,data.length,now);
  if (!reserved) throw new ProviderError('Save a visible review first. Each review can have up to three photos.',409);
  const budget = await db.prepare('UPDATE review_photo_storage_budget SET bytes_used=bytes_used+? WHERE singleton=1 AND bytes_used+?<=? RETURNING bytes_used').bind(data.length,data.length,MAX_STORED_BYTES).first<BudgetRow>();
  if (!budget) { await db.prepare('DELETE FROM review_photos WHERE id=?').bind(id).run(); throw new ProviderError('SPOTLAND photo storage is full for now. No photo was uploaded.',507); }
  try {
    await store.put(key,data,{httpMetadata:{contentType:'image/jpeg',cacheControl:'private, max-age=60'},customMetadata:{photoId:id,reviewId}});
    const ready = await db.prepare("UPDATE review_photos SET status='pending' WHERE id=? RETURNING id").bind(id).first<{id:string}>();
    if (!ready) throw new Error('Review photo reservation disappeared.');
  } catch {
    try { await store.delete(key); await db.prepare('DELETE FROM review_photos WHERE id=?').bind(id).run(); await db.prepare('UPDATE review_photo_storage_budget SET bytes_used=MAX(0,bytes_used-?) WHERE singleton=1').bind(data.length).run(); } catch { /* The scheduled cleanup retries stale reservations. */ }
    throw new ProviderError('Photo upload was not confirmed. Retry when you have a connection.',503);
  }
  return {id,status:'pending' as const};
}
async function ownerAction(request: Request, env: ReviewPhotoEnv, now: number) {
  requireOrigin(request,env.ALLOWED_ORIGIN);
  const db = requireDb(env), store = bucket(env), user = await sessionUser(request,db,now);
  if (!user) throw new ProviderError('Sign in to manage your review photos.',401);
  const parsed = await bodyJson(request,1000);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new ProviderError('Invalid photo request.',400);
  const data = parsed as Record<string,unknown>;
  if (!validId(data.id) || !['remove','report'].includes(String(data.action))) throw new ProviderError('Invalid photo request.',400);
  const row = await db.prepare("SELECT p.id,p.review_id,p.owner_user_id,p.object_key,p.content_type,p.size_bytes,p.status,p.created_at,p.slot,r.status AS review_status FROM review_photos p JOIN reviews r ON r.id=p.review_id WHERE p.id=? AND p.status!='uploading'").bind(data.id).first<PhotoRow & {review_status:string}>();
  if (!row || (data.action === 'remove' && row.owner_user_id !== user.id) || (data.action === 'report' && (row.status !== 'approved' || row.review_status!=='visible'))) return data.action === 'remove' ? {removed:true} : {reported:true};
  if (data.action === 'remove') { await reviewLimit(db,user.id,'photo-remove',30,0,now); await removeOne(db,store,row); return {removed:true}; }
  if (row.owner_user_id === user.id) throw new ProviderError('Remove your own photo instead of reporting it.',400);
  if (!await db.prepare('SELECT photo_id FROM review_photo_reports WHERE photo_id=? AND user_id=?').bind(row.id,user.id).first()) {
    await reviewLimit(db,user.id,'photo-report',20,0,now);
    await reviewLimit(db,request.headers.get('CF-Connecting-IP') || 'local','photo-report-network',100,0,now);
    if (!db.batch) throw new ProviderError('Photo reporting is unavailable. Retry shortly.',503);
    await db.batch([
      db.prepare('INSERT OR IGNORE INTO review_photo_reports (photo_id,user_id,created_at) VALUES (?,?,?)').bind(row.id,user.id,now),
      db.prepare("UPDATE review_photos SET status='hidden' WHERE id=? AND (SELECT COUNT(*) FROM review_photo_reports WHERE photo_id=?)>=3").bind(row.id,row.id),
    ]);
  }
  return {reported:true};
}
async function moderate(request: Request, env: ReviewPhotoEnv) {
  const db = requireDb(env), store = bucket(env);
  await requireAdmin(request,env);
  if (request.method === 'GET') return (await db.prepare(`SELECT p.id,p.review_id AS reviewId,r.place_id AS placeId,r.rating,r.text,p.status,(SELECT COUNT(*) FROM review_photo_reports WHERE photo_id=p.id) AS reports,p.created_at AS createdAt FROM review_photos p JOIN reviews r ON r.id=p.review_id WHERE p.status IN ('pending','hidden') ORDER BY p.created_at LIMIT 100`).all()).results;
  requireOrigin(request,env.ALLOWED_ORIGIN);
  const parsed = await bodyJson(request,1000);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new ProviderError('Invalid photo moderation request.',400);
  const data = parsed as Record<string,unknown>;
  if (!validId(data.id) || !['approve','hide','delete'].includes(String(data.action))) throw new ProviderError('Invalid photo moderation request.',400);
  const row = await db.prepare('SELECT p.id,p.review_id,p.owner_user_id,p.object_key,p.content_type,p.size_bytes,p.status,p.created_at,p.slot,r.status AS review_status FROM review_photos p JOIN reviews r ON r.id=p.review_id WHERE p.id=?').bind(data.id).first<PhotoRow & {review_status:string}>();
  if (!row) throw new ProviderError('Review photo not found.',404);
  if (data.action === 'delete') { await removeOne(db,store,row); return {deleted:true}; }
  if (data.action === 'approve' && row.review_status!=='visible') throw new ProviderError('Make the review visible before approving its photo.',409);
  const next = data.action === 'approve' ? 'approved' : 'hidden';
  await db.prepare('UPDATE review_photos SET status=? WHERE id=?').bind(next,row.id).run();
  return {status:next};
}
export async function reviewPhotoApi(request: Request, env: ReviewPhotoEnv, now = Date.now()) {
  const path = new URL(request.url).pathname;
  if (path === '/api/admin/review-photos') {
    if (!['GET','POST'].includes(request.method)) throw new ProviderError('Method not allowed.',405);
    return moderate(request,env);
  }
  if (path === '/api/review-photos') {
    if (request.method === 'POST' && (request.headers.get('Content-Type') || '').toLowerCase().startsWith('multipart/form-data;')) return uploadPhoto(request,env,now);
    if (request.method === 'POST' && (request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) return ownerAction(request,env,now);
    throw new ProviderError('Method not allowed.',405);
  }
  throw new ProviderError('Not found.',404);
}
export async function reviewPhotoImage(request: Request, env: ReviewPhotoEnv, id: string) {
  if (request.method !== 'GET') throw new ProviderError('Method not allowed.',405);
  if (!validId(id)) throw new ProviderError('Photo not found.',404);
  const db = requireDb(env), store = bucket(env), url = new URL(request.url), isAdminPreview = url.pathname.startsWith('/api/admin/');
  if (isAdminPreview) await requireAdmin(request,env);
  const row = await db.prepare(`SELECT p.object_key,p.content_type,p.status,r.status AS review_status FROM review_photos p JOIN reviews r ON r.id=p.review_id WHERE p.id=?`).bind(id).first<{object_key:string;content_type:string;status:string;review_status:string}>();
  if (!row || (!isAdminPreview && (row.status !== 'approved' || row.review_status !== 'visible')) || (isAdminPreview && row.status === 'uploading')) throw new ProviderError('Photo not found.',404);
  const object = await store.get(row.object_key); if (!object) throw new ProviderError('Photo not found.',404);
  const headers = new Headers({'Content-Type':row.content_type,'Content-Length':String(object.size),'Cache-Control':isAdminPreview?'no-store':'private, max-age=60','X-Content-Type-Options':'nosniff','Content-Disposition':'inline; filename="spotland-review-photo.jpg"','ETag':object.httpEtag,'Referrer-Policy':'no-referrer'});
  return new Response(object.body,{headers});
}
export async function cleanupReviewPhotos(env: ReviewPhotoEnv, now = Date.now()) {
  if (!env.DB || !env.REVIEW_PHOTOS) return;
  const db = env.DB, store = env.REVIEW_PHOTOS;
  const stale = (await db.prepare("SELECT id,object_key,size_bytes FROM review_photos WHERE status='uploading' AND created_at<? LIMIT 100").bind(now-3600000).all<{id:string;object_key:string;size_bytes:number}>()).results;
  for (const row of stale) {
    try {
      await store.delete(row.object_key);
      await db.prepare("DELETE FROM review_photos WHERE id=? AND status='uploading'").bind(row.id).run();
      await db.prepare('UPDATE review_photo_storage_budget SET bytes_used=MAX(0,bytes_used-?) WHERE singleton=1').bind(row.size_bytes).run();
    } catch { /* Keep the reservation until the next scheduled cleanup. */ }
  }
}
export { jpegIsMetadataFree, MAX_PHOTO_BYTES, MAX_STORED_BYTES };
