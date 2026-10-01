import { expect, test } from 'vitest';
import { tripsApi } from './trips';
import { testDb } from './test-db';
import { hashToken } from './accounts';
const origin='https://spotland.pages.dev',now=Date.UTC(2026,9,1);
const plan={name:'Delhi detour',date:'2026-10-01',mode:'walk',stops:[{name:'A',address:'Delhi',lat:28.6,lon:77.2},{name:'B',address:'Delhi',lat:28.61,lon:77.21},{name:'C',address:'Delhi',lat:28.62,lon:77.22}]};
const req=(data,cookie='',id='')=>new Request(origin+'/api/trips'+(id?'?id='+id:''),{method:data?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:data?JSON.stringify(data):undefined});
async function owner(db){const id=crypto.randomUUID(),token=Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');await db.prepare('INSERT INTO users (id,google_sub,name,created_at) VALUES (?,?,?,?)').bind(id,id,'Test traveller',now).run();await db.prepare('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').bind(await hashToken(token),id,now+3600000).run();return {id,cookie:'__Host-spotland_session='+token};}
const env=db=>({DB:db,ALLOWED_ORIGIN:origin});
test('anonymous planning does not authorize storage; sessions/origin are required and trips are isolated per user',async()=>{
 const db=testDb(),a=await owner(db),b=await owner(db),id=crypto.randomUUID(),save={action:'save',id,trip:plan};
 await expect(tripsApi(req(save),env(db),now)).rejects.toMatchObject({status:401});
 const wrong=req(save,a.cookie);wrong.headers.set('Origin','https://evil.test');await expect(tripsApi(wrong,env(db),now)).rejects.toMatchObject({status:403});
 const result=await tripsApi(req(save,a.cookie),env(db),now);expect(result).toEqual({...plan,id,savedAt:now});
 expect(await tripsApi(req(null,b.cookie),env(db),now)).toEqual([]);await expect(tripsApi(req(null,b.cookie,id),env(db),now)).rejects.toMatchObject({status:404});
 await tripsApi(req({action:'remove',id},b.cookie),env(db),now);expect((await tripsApi(req(null,a.cookie,id),env(db),now)).stops).toEqual(plan.stops);
 await expect(tripsApi(req(save,b.cookie),env(db),now)).rejects.toMatchObject({status:409});
 await expect(tripsApi(req(null,a.cookie),env(db),now+3600000)).rejects.toMatchObject({status:401});
});
test('save retries are idempotent, order reopens exactly, edits require new id and removal cascades stops',async()=>{
 const db=testDb(),a=await owner(db),id=crypto.randomUUID(),save={action:'save',id,trip:plan};const first=await tripsApi(req(save,a.cookie),env(db),now);
 expect(await tripsApi(req(save,a.cookie),env(db),now+1000)).toEqual(first);expect((await db.prepare('SELECT COUNT(*) n FROM trip_stops').first()).n).toBe(3);
 await expect(tripsApi(req({...save,trip:{...plan,stops:[...plan.stops].reverse()}},a.cookie),env(db),now)).rejects.toMatchObject({status:409});
 expect((await tripsApi(req(null,a.cookie,id),env(db),now)).stops).toEqual(plan.stops);
 await tripsApi(req({action:'remove',id},a.cookie),env(db),now);expect(await tripsApi(req(null,a.cookie),env(db),now)).toEqual([]);expect((await db.prepare('SELECT COUNT(*) n FROM trip_stops').first()).n).toBe(0);
});
test('failed stop insertion rolls back the entire D1 batch; invalid data never creates a trip',async()=>{
 const db=testDb(),a=await owner(db),id=crypto.randomUUID();const broken={...db,batch:statements=>db.batch([...statements,db.prepare('INSERT INTO trip_stops (trip_id,sort_order,name,address,lat,lon) VALUES (?,?,?,?,?,?)').bind(id,0,'duplicate','',28,77)])};
 await expect(tripsApi(req({action:'save',id,trip:plan},a.cookie),env(broken),now)).rejects.toThrow();expect((await db.prepare('SELECT COUNT(*) n FROM trips').first()).n).toBe(0);expect((await db.prepare('SELECT COUNT(*) n FROM trip_stops').first()).n).toBe(0);
 await expect(tripsApi(req({action:'save',id,trip:{...plan,stops:[]}},a.cookie),env(db),now)).rejects.toMatchObject({status:400});
});
test('collection cap is enforced atomically without partial stops; existing retry still works at capacity',async()=>{
 const db=testDb(),a=await owner(db),id=crypto.randomUUID();await tripsApi(req({action:'save',id,trip:plan},a.cookie),env(db),now);
 for(let i=0;i<49;i++)await db.prepare('INSERT INTO trips (id,user_id,name,trip_date,mode,saved_at,mutation_key) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),a.id,'Seed','2026-10-01','walk',now,'test').run();
 await expect(tripsApi(req({action:'save',id:crypto.randomUUID(),trip:plan},a.cookie),env(db),now)).rejects.toMatchObject({status:409});expect((await db.prepare('SELECT COUNT(*) n FROM trip_stops').first()).n).toBe(3);
 expect((await tripsApi(req({action:'save',id,trip:plan},a.cookie),env(db),now)).id).toBe(id);expect(await tripsApi(req(null,a.cookie),env(db),now)).toHaveLength(50);
});
