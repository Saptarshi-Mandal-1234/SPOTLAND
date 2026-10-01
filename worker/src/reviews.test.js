import { expect, test } from 'vitest';
import { reviewsApi } from './reviews';
import { testDb } from './test-db';
import { hashToken } from './accounts';
import worker from './index';
const origin='https://spotland.pages.dev', now=Date.UTC(2026,9,1);
const env=db=>({DB:db,ALLOWED_ORIGIN:origin,ADMIN_TOKEN:'fixture-admin'});
const req=(data,cookie='',placeId='node/1',admin=false)=>new Request(origin+(admin?'/api/admin/reviews':'/api/reviews')+'?'+new URLSearchParams({placeId}),{method:data?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,...(admin?{Authorization:'Bearer fixture-admin'}:{})},body:data?JSON.stringify(data):undefined});
async function owner(db) { const id=crypto.randomUUID(),token=Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url'); await db.prepare('INSERT INTO users (id,google_sub,name,created_at) VALUES (?,?,?,?)').bind(id,id,'Private test name',now).run(); await db.prepare('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').bind(await hashToken(token),id,now+86400000).run();return {id,cookie:'__Host-spotland_session='+token}; }
const save={action:'save',placeId:'node/1',rating:4,text:'A nice public place to visit.'};
test('reading is anonymous; writes enforce auth, origin, validation and owner isolation',async()=>{
 const db=testDb(),a=await owner(db),b=await owner(db);
 expect(await reviewsApi(req(),env(db),now)).toEqual({reviews:[],count:0,average:null,mine:null});
 await expect(reviewsApi(req(save),env(db),now)).rejects.toMatchObject({status:401}); const wrong=req(save,a.cookie);wrong.headers.set('Origin','https://evil.test');await expect(reviewsApi(wrong,env(db),now)).rejects.toMatchObject({status:403});
 await expect(reviewsApi(req({...save,rating:6},a.cookie),env(db),now)).rejects.toMatchObject({status:400});
 const {id}=await reviewsApi(req(save,a.cookie),env(db),now); const list=await reviewsApi(req(),env(db),now); expect(list.count).toBe(1);expect(list.average).toBe(4);expect(list.mine).toBeNull();expect(JSON.stringify(list)).not.toContain(a.id);expect(JSON.stringify(list)).not.toContain('Private test name');
 await reviewsApi(req({action:'remove',id},b.cookie),env(db),now);expect((await reviewsApi(req(),env(db),now)).count).toBe(1);
 await reviewsApi(req({action:'remove',id},a.cookie),env(db),now);expect((await reviewsApi(req(),env(db),now)).average).toBeNull();
});
test('save retries do not duplicate ratings; edits respect cooldown and daily quotas',async()=>{
 const db=testDb(),a=await owner(db); const first=await reviewsApi(req(save,a.cookie),env(db),now);expect(await reviewsApi(req(save,a.cookie),env(db),now+1)).toEqual(first);
 await expect(reviewsApi(req({...save,text:'An edited public review.'},a.cookie),env(db),now+1)).rejects.toMatchObject({status:429});
 for(let i=1;i<10;i++) await reviewsApi(req({...save,rating:5,text:'An edited public review number '+i},a.cookie),env(db),now+i*31000);
 await expect(reviewsApi(req({...save,text:'One publish too many today.'},a.cookie),env(db),now+310000)).rejects.toMatchObject({status:429});
 const list=await reviewsApi(req(null,a.cookie),env(db),now);expect(list.count).toBe(1);expect(list.average).toBe(5);expect(list.mine.id).toBe(first.id);
});
test('reports are distinct, transactional, auto-hide at three, and hidden reviews cannot be edited',async()=>{
 const db=testDb(),a=await owner(db),b=await owner(db),c=await owner(db),d=await owner(db);const {id}=await reviewsApi(req(save,a.cookie),env(db),now);
 await expect(reviewsApi(req({action:'report',id},a.cookie),env(db),now)).rejects.toMatchObject({status:400});
 await reviewsApi(req({action:'report',id},b.cookie),env(db),now);
 const limitsBefore=await db.prepare('SELECT SUM(count) n FROM submission_limits').first();
 for(let retry=0;retry<25;retry++) await reviewsApi(req({action:'report',id},b.cookie),env(db),now);
 expect(await db.prepare('SELECT SUM(count) n FROM submission_limits').first()).toEqual(limitsBefore);
 expect((await db.prepare('SELECT COUNT(*) n FROM review_reports').first()).n).toBe(1);
 const broken={...db,batch:statements=>db.batch([...statements,db.prepare('INSERT INTO no_such_table VALUES (1)')])};await expect(reviewsApi(req({action:'report',id},c.cookie),env(broken),now)).rejects.toThrow();expect((await db.prepare('SELECT COUNT(*) n FROM review_reports').first()).n).toBe(1);
 await reviewsApi(req({action:'report',id},c.cookie),env(db),now);await reviewsApi(req({action:'report',id},d.cookie),env(db),now);
 expect(await reviewsApi(req(),env(db),now)).toEqual({reviews:[],count:0,average:null,mine:null});expect((await reviewsApi(req(null,a.cookie),env(db),now)).mine.status).toBe('hidden');
 await expect(reviewsApi(req({...save,text:'Trying to revive a hidden review.'},a.cookie),env(db),now+31000)).rejects.toMatchObject({status:409});
 await reviewsApi(req({action:'remove',id},a.cookie),env(db),now);expect((await db.prepare('SELECT COUNT(*) n FROM review_reports').first()).n).toBe(0);
});
test('moderator hiding is authenticated and ratings are SPOTLAND-only; API responses are no-store',async()=>{
 const db=testDb(),a=await owner(db);const {id}=await reviewsApi(req({...save,text:'😀'.repeat(10)},a.cookie),env(db),now);
 const unauthorized=req(null,'','node/1',true);unauthorized.headers.delete('Authorization');await expect(reviewsApi(unauthorized,env(db),now)).rejects.toMatchObject({status:401});
 expect(await reviewsApi(req({action:'hide',id},'','node/1',true),env(db),now)).toEqual({hidden:true});expect((await reviewsApi(req(),env(db),now)).count).toBe(0);
 const response=await worker.fetch(req(),env(db));expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toBe('no-store');
 const admin=await reviewsApi(req(null,'','node/1',true),env(db),now);expect(admin[0]).toMatchObject({id,status:'hidden'});
});
