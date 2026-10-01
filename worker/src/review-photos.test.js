import { expect, test, vi, afterEach } from 'vitest';
import { hashToken } from './accounts';
import { reviewsApi } from './reviews';
import { cleanupReviewPhotos, reviewPhotoApi, reviewPhotoImage } from './review-photos';
import { testDb } from './test-db';

const origin='https://spotland.pages.dev', now=Date.UTC(2026,9,1);
const jpeg=new Uint8Array([0xff,0xd8,0xff,0xe0,0x00,0x04,0x4a,0x46,0xff,0xda,0x00,0x02,0x11,0x22,0xff,0xd9]);
function store() {
  const objects=new Map();
  return {objects,async put(key,value,options) {objects.set(key,{bytes:new Uint8Array(value),contentType:options.httpMetadata.contentType});},async get(key) {const value=objects.get(key);return value?{body:new Response(value.bytes).body,size:value.bytes.length,httpEtag:'"fixture-etag"'}:null;},async delete(keys) {for(const key of Array.isArray(keys)?keys:[keys]) objects.delete(key);}};
}
function env(db,REVIEW_PHOTOS=store()) { return {DB:db,REVIEW_PHOTOS,ALLOWED_ORIGIN:origin,ADMIN_TOKEN:'fixture-admin'}; }
async function user(db,name='Private test name') {const id=crypto.randomUUID(),token=Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');await db.prepare('INSERT INTO users (id,google_sub,name,created_at) VALUES (?,?,?,?)').bind(id,id,name,now).run();await db.prepare('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').bind(await hashToken(token),id,now+86400000).run();return {id,cookie:`__Host-spotland_session=${token}`};}
async function review(db,owner) {return reviewsApi(new Request(`${origin}/api/reviews`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:owner.cookie},body:JSON.stringify({action:'save',placeId:'node/11',rating:5,text:'A public place worth a visit.'})}),env(db),now);}
function uploadRequest(owner,reviewId,photoBytes=jpeg,type='image/jpeg') {const form=new FormData();form.set('reviewId',reviewId);form.set('photo',new File([photoBytes],'photo.jpg',{type}));return new Request(`${origin}/api/review-photos`,{method:'POST',headers:{Origin:origin,Cookie:owner.cookie},body:form});}
function jsonRequest(path,data,cookie='',admin=false) {return new Request(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...(admin?{Authorization:'Bearer fixture-admin'}:{})},body:JSON.stringify(data)});}

afterEach(()=>vi.unstubAllGlobals());

test('photo upload requires an owned visible review, strips metadata, and remains hidden pending approval',async()=>{
 const db=testDb(),owner=await user(db),storeBucket=store(),service=env(db,storeBucket);
 await expect(reviewPhotoApi(uploadRequest(owner,crypto.randomUUID()),service,now)).rejects.toMatchObject({status:409});
 const saved=await review(db,owner);
 const exif=new Uint8Array([0xff,0xd8,0xff,0xe1,0x00,0x08,0x45,0x78,0x69,0x66,0,0,0xff,0xda,0x00,0x02,0xff,0xd9]);
 await expect(reviewPhotoApi(uploadRequest(owner,saved.id,exif),service,now)).rejects.toMatchObject({status:400});
 const result=await reviewPhotoApi(uploadRequest(owner,saved.id),service,now);
 expect(result).toMatchObject({status:'pending'});expect(storeBucket.objects.size).toBe(1);
 const publicList=await reviewsApi(new Request(`${origin}/api/reviews?placeId=node%2F11`,{headers:{Cookie:owner.cookie}}),service,now);
 expect(publicList.reviews[0].photos).toEqual([]);expect(publicList.mine.photos).toMatchObject([{id:result.id,status:'pending'}]);
 const preview=await reviewPhotoImage(new Request(`${origin}/api/admin/review-photos/${result.id}`,{headers:{Authorization:'Bearer fixture-admin'}}),service,result.id);
 expect(preview.status).toBe(200);expect(preview.headers.get('Cache-Control')).toBe('no-store');
});

test('moderation approves for public display; three distinct reports hide a photo; owner can delete it',async()=>{
 const db=testDb(),owner=await user(db),reporters=await Promise.all([user(db,'A'),user(db,'B'),user(db,'C')]),storeBucket=store(),service=env(db,storeBucket);
 const saved=await review(db,owner),uploaded=await reviewPhotoApi(uploadRequest(owner,saved.id),service,now);
 await expect(reviewPhotoApi(jsonRequest('/api/admin/review-photos',{action:'approve',id:uploaded.id}),service,now)).rejects.toMatchObject({status:401});
 await reviewPhotoApi(jsonRequest('/api/admin/review-photos',{action:'approve',id:uploaded.id},'',true),service,now);
 let publicList=await reviewsApi(new Request(`${origin}/api/reviews?placeId=node%2F11`,{headers:{Cookie:owner.cookie}}),service,now);
 expect(publicList.reviews[0].photos).toEqual([{id:uploaded.id,status:'approved',url:`/api/review-photos/${uploaded.id}`}]);
 const image=await reviewPhotoImage(new Request(`${origin}/api/review-photos/${uploaded.id}`),service,uploaded.id);expect(image.headers.get('Content-Type')).toBe('image/jpeg');
 for(const reporter of reporters) await reviewPhotoApi(jsonRequest('/api/review-photos',{action:'report',id:uploaded.id},reporter.cookie),service,now);
 await expect(reviewPhotoImage(new Request(`${origin}/api/review-photos/${uploaded.id}`),service,uploaded.id)).rejects.toMatchObject({status:404});
 publicList=await reviewsApi(new Request(`${origin}/api/reviews?placeId=node%2F11`,{headers:{Cookie:owner.cookie}}),service,now);expect(publicList.reviews[0].photos).toEqual([]);
 await reviewPhotoApi(jsonRequest('/api/review-photos',{action:'remove',id:uploaded.id},owner.cookie),service,now);
 expect(storeBucket.objects.size).toBe(0);expect((await db.prepare('SELECT bytes_used FROM review_photo_storage_budget').first()).bytes_used).toBe(0);
});

test('per-review maximum, storage ceiling, authenticated moderation and photo cascade removal are enforced',async()=>{
 const db=testDb(),owner=await user(db),storeBucket=store(),service=env(db,storeBucket),saved=await review(db,owner);
 const first=await reviewPhotoApi(uploadRequest(owner,saved.id),service,now);
 await reviewPhotoApi(uploadRequest(owner,saved.id),service,now+16000);
 await reviewPhotoApi(uploadRequest(owner,saved.id),service,now+32000);
 await expect(reviewPhotoApi(uploadRequest(owner,saved.id),service,now+48000)).rejects.toMatchObject({status:409});
 const unauthorized=new Request(`${origin}/api/admin/review-photos`);await expect(reviewPhotoApi(unauthorized,service,now)).rejects.toMatchObject({status:401});
 await db.prepare('UPDATE review_photo_storage_budget SET bytes_used=? WHERE singleton=1').bind(8*1024*1024*1024).run();
 const secondOwner=await user(db,'Second owner'),second=await review(db,secondOwner);
 await expect(reviewPhotoApi(uploadRequest(secondOwner,second.id),service,now+64000)).rejects.toMatchObject({status:507});
 await db.prepare('UPDATE review_photo_storage_budget SET bytes_used=0 WHERE singleton=1').run();
 await reviewsApi(new Request(`${origin}/api/reviews`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:owner.cookie},body:JSON.stringify({action:'remove',id:saved.id})}),service,now+64000);
 expect(storeBucket.objects.size).toBe(0);expect((await db.prepare('SELECT COUNT(*) n FROM review_photos').first()).n).toBe(0);
 expect((await db.prepare('SELECT bytes_used FROM review_photo_storage_budget').first()).bytes_used).toBe(0);expect(first.id).toBeTruthy();
});

test('stale in-flight uploads are removed and free their reserved storage',async()=>{
 const db=testDb(),owner=await user(db),storeBucket=store(),service=env(db,storeBucket),saved=await review(db,owner),id=crypto.randomUUID(),key=`reviews/${saved.id}/${id}.jpg`;
 await db.prepare("INSERT INTO review_photos (id,review_id,owner_user_id,object_key,content_type,size_bytes,status,created_at,slot) VALUES (?,?,?,?,'image/jpeg',?,'uploading',?,0)").bind(id,saved.id,owner.id,key,jpeg.length,now-7200000).run();
 await db.prepare('UPDATE review_photo_storage_budget SET bytes_used=? WHERE singleton=1').bind(jpeg.length).run();await storeBucket.put(key,jpeg,{httpMetadata:{contentType:'image/jpeg'}});
 await cleanupReviewPhotos(service,now);expect(storeBucket.objects.size).toBe(0);expect((await db.prepare('SELECT bytes_used FROM review_photo_storage_budget').first()).bytes_used).toBe(0);
});
