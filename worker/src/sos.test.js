import { expect, test, vi } from 'vitest';
import { testDb } from './test-db';
import { liveShareApi } from './live-share';
import { sosApi, cleanupSos, dispatchSosPush } from './sos';
import { encodeArea } from '../../shared/sos';
import * as push from './web-push';
const origin='https://spotland.pages.dev', now=Date.UTC(2026,9,1), geohash=encodeArea(28.6,77.2);
const env = db => ({DB:db,ALLOWED_ORIGIN:origin,DEVICE_SECRET:'test-secret-which-is-more-than-forty-three-characters',SOS_ENABLED:'true'});
const req = (path,data,cookie='',ip='192.0.2.1') => new Request(origin+'/api/'+path,{method:data?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,'CF-Connecting-IP':ip},body:data?JSON.stringify(data):undefined});
async function device(db,ip='192.0.2.1') { const h=new Headers(); await liveShareApi(req('share-device',{consent:true},'',ip),env(db),h,now); return h.get('Set-Cookie').split(';')[0]; }
async function fixture() { const db=testDb(),cookie=await device(db),shareId=crypto.randomUUID(); await liveShareApi(req('live-share',{action:'create',id:shareId,token:Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url'),hours:1,consent:true,position:{lat:28.6,lon:77.2,accuracy:15}},cookie),env(db),new Headers(),now); return {db,cookie,data:{action:'create',id:crypto.randomUUID(),shareId,geohash,startedAt:now,consent:true}}; }
test('SOS requires signed device, consent, same origin, owned private share and fixed radius; push stays disconnected',async()=>{
 const {db,cookie,data}=await fixture(); expect(await sosApi(req('sos-config'),env(db),now)).toMatchObject({enabled:true,pushPublicKey:null,radiusKm:2});
 await expect(sosApi(req('sos',data),env(db),now)).rejects.toMatchObject({status:401});
 for(const patch of [{consent:false},{radius:3},{geohash:geohash+'x'},{shareId:crypto.randomUUID()},{startedAt:now-900001}]) await expect(sosApi(req('sos',{...data,...patch},cookie),env(db),now)).rejects.toMatchObject({status:400});
 const wrong=req('sos',data,cookie);wrong.headers.set('Origin','https://evil.test');await expect(sosApi(wrong,env(db),now)).rejects.toMatchObject({status:403});
 const result=await sosApi(req('sos',data,cookie),env(db),now);expect(result).toMatchObject({status:'active',expiresAt:now+3600000,push:{sent:0,eligible:0}});
 expect(await sosApi(req('sos',data,cookie),env(db),now+1000)).toEqual(result); await dispatchSosPush(env(db),data.id,now);
 await expect(sosApi(req('sos',{...data,id:crypto.randomUUID()},cookie),env(db),now+1000)).rejects.toMatchObject({status:429});
});
test('push subscribe/test/unsubscribe requires separate consent; test targets only the requesting device',async()=>{
 const {db,cookie}=await fixture(),configured={...env(db),VAPID_PUBLIC_KEY:'a'.repeat(87),VAPID_PRIVATE_KEY:'a'.repeat(43),VAPID_SUBJECT:'mailto:test@example.com'};
 const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/test',expirationTime:null,keys:{p256dh:'a'.repeat(87),auth:'a'.repeat(22)}};
 await expect(sosApi(req('nearby-alerts',{action:'subscribe',consent:true,subscription},cookie),configured,now)).rejects.toMatchObject({status:403});
 await sosApi(req('nearby-alerts',{action:'optin',consent:true,geohash},cookie),configured,now);
 await expect(sosApi(req('nearby-alerts',{action:'subscribe',subscription},cookie),configured,now)).rejects.toMatchObject({status:400});
 expect(await sosApi(req('nearby-alerts',{action:'subscribe',consent:true,subscription},cookie),configured,now)).toMatchObject({pushEnabled:true});
 const deliver=vi.spyOn(push,'deliverPush').mockResolvedValue('accepted');
 try {
  await expect(sosApi(req('nearby-alerts',{action:'test'},cookie),configured,now)).rejects.toMatchObject({status:400});
  expect(await sosApi(req('nearby-alerts',{action:'test',consent:true},cookie),configured,now)).toMatchObject({accepted:true});
  expect(deliver).toHaveBeenCalledWith(configured,subscription,expect.objectContaining({type:'spotland-push-test'}),now);
  expect((await db.prepare('SELECT COUNT(*) n FROM sos_alerts').first()).n).toBe(0);
  expect(await sosApi(req('nearby-alerts',{action:'unsubscribe'},cookie),configured,now)).toMatchObject({pushEnabled:false,expiresAt:now+3600000});
  await expect(sosApi(req('nearby-alerts',{action:'test',consent:true},cookie),configured,now)).rejects.toMatchObject({status:403});
 }finally{deliver.mockRestore();}
});
test('36 recipients dispatch in the first invocation with six concurrent sends and bounded queries; 37 fails visibly',async()=>{
 const {db,cookie,data}=await fixture(),configured={...env(db),VAPID_PUBLIC_KEY:'a'.repeat(87),VAPID_PRIVATE_KEY:'a'.repeat(43),VAPID_SUBJECT:'mailto:test@example.com'};
 for(let i=0;i<36;i++){const c=await device(db,'192.0.2.'+(i+2));await sosApi(req('nearby-alerts',{action:'optin',consent:true,geohash},c,'192.0.2.'+(i+2)),configured,now);}
 await db.prepare("UPDATE devices SET push_sub='{}' WHERE geohash IS NOT NULL").run();
 let active=0,max=0;const deliver=vi.spyOn(push,'deliverPush').mockImplementation(async()=>{active++;max=Math.max(max,active);await Promise.resolve();active--;return 'accepted';});
 const queries=vi.spyOn(db,'prepare');
 try {
  await sosApi(req('sos',data,cookie),configured,now);await dispatchSosPush(configured,data.id,now);
  expect(queries.mock.calls.length).toBeLessThan(50);expect(deliver).toHaveBeenCalledTimes(36);expect(max).toBeLessThanOrEqual(6);
  expect(await sosApi(req('sos',{action:'status',id:data.id},cookie),configured,now)).toMatchObject({push:{sent:36,pending:0,failed:0,eligible:36}});
  const c=await device(db,'192.0.2.200');await sosApi(req('nearby-alerts',{action:'optin',consent:true,geohash},c,'192.0.2.200'),configured,now);await db.prepare("UPDATE devices SET push_sub='{}' WHERE geohash IS NOT NULL").run();
  await expect(sosApi(req('sos',{...data,id:crypto.randomUUID()},cookie),configured,now+310000)).rejects.toMatchObject({status:503});
 }finally{deliver.mockRestore();queries.mockRestore();}
});
test('failed alert/queue transaction leaves no partial alert and allows retry',async()=>{
 const {db,cookie,data}=await fixture();const batch=vi.spyOn(db,'batch').mockRejectedValueOnce(new Error('disk failure'));
 try{
  await expect(sosApi(req('sos',data,cookie),env(db),now)).rejects.toMatchObject({status:503});
  expect((await db.prepare('SELECT COUNT(*) n FROM sos_alerts').first()).n).toBe(0);
  expect((await db.prepare('SELECT COUNT(*) n FROM push_deliveries').first()).n).toBe(0);
  expect(await sosApi(req('sos',data,cookie),env(db),now+1000)).toMatchObject({status:'active'});
 }finally{batch.mockRestore();}
});
test('only opted-in devices within 2 km see anonymous coarse alerts; duplicate reports do not count twice; three hide',async()=>{
 const {db,cookie,data}=await fixture();await sosApi(req('sos',data,cookie),env(db),now);
 const receivers=[];for(let i=0;i<3;i++){const c=await device(db,'192.0.2.'+(i+2));receivers.push(c);await sosApi(req('nearby-alerts',{action:'optin',consent:true,geohash},c),env(db),now);}
 const list=await sosApi(req('nearby-alerts',{action:'list'},receivers[0]),env(db),now);expect(list.alerts).toHaveLength(1);expect(Object.keys(list.alerts[0]).sort()).toEqual(['createdAt','direction','distanceKm','expiresAt','geohash','id']);
 expect(await sosApi(req('nearby-alerts',{action:'status'},receivers[0]),env(db),now)).toEqual(list);
 const far=await device(db,'192.0.2.9');expect((await sosApi(req('nearby-alerts',{action:'optin',consent:true,geohash:encodeArea(19.1,72.9)},far),env(db),now)).alerts).toEqual([]);await expect(sosApi(req('sos',{action:'help',id:data.id},far),env(db),now)).rejects.toMatchObject({status:404});
 await sosApi(req('sos',{action:'help',id:data.id},receivers[0]),env(db),now);
 for(const c of [receivers[0],receivers[0],receivers[1]]) await sosApi(req('sos',{action:'report',id:data.id},c),env(db),now);
 expect((await db.prepare('SELECT report_count,status FROM sos_alerts').first())).toMatchObject({report_count:2,status:'active'});
 await sosApi(req('sos',{action:'report',id:data.id},receivers[2]),env(db),now);expect((await sosApi(req('nearby-alerts',{action:'list'},receivers[0]),env(db),now)).alerts).toEqual([]);
 await cleanupSos(env(db),now+3600001);expect((await db.prepare('SELECT COUNT(*) n FROM sos_alerts').first()).n).toBe(0);expect((await db.prepare('SELECT COUNT(*) n FROM sos_reports').first()).n).toBe(0);expect((await db.prepare('SELECT COUNT(*) n FROM devices WHERE geohash IS NOT NULL').first()).n).toBe(0);
});
test('safe closes alert, clears area and prevents delayed creation after cancellation; other owners cannot close',async()=>{
 const {db,cookie,data}=await fixture();await sosApi(req('sos',{action:'close',id:data.id},cookie),env(db),now);await expect(sosApi(req('sos',data,cookie),env(db),now)).rejects.toMatchObject({status:410});
 const next={...data,id:crypto.randomUUID()};await sosApi(req('sos',next,cookie),env(db),now);const other=await device(db,'192.0.2.9');await expect(sosApi(req('sos',{action:'close',id:next.id},other),env(db),now)).rejects.toMatchObject({status:404});
 await sosApi(req('sos',{action:'close',id:next.id},cookie),env(db),now);expect(await db.prepare('SELECT status,geohash FROM sos_alerts').first()).toMatchObject({status:'safe',geohash:''});
});
test('push jobs retry at most three times and never deliver after opt-out or closing',async()=>{
 const {db,cookie,data}=await fixture(),receiver=await device(db,'192.0.2.2');
 await sosApi(req('nearby-alerts',{action:'optin',consent:true,geohash},receiver),env(db),now);
 const target=await db.prepare('SELECT id FROM devices WHERE geohash=?').bind(geohash).first();await db.prepare('UPDATE devices SET push_sub=? WHERE id=?').bind('{}',target.id).run();
 const configured={...env(db),VAPID_PUBLIC_KEY:'a'.repeat(87),VAPID_PRIVATE_KEY:'a'.repeat(43),VAPID_SUBJECT:'mailto:test@example.com'};
 await sosApi(req('sos',data,cookie),configured,now);
 const deliver=vi.spyOn(push,'deliverPush').mockRejectedValue(new Error('network offline'));
 try {
   for(let i=0;i<3;i++) await dispatchSosPush(configured,data.id,now+i*31000);
   expect(deliver).toHaveBeenCalledTimes(3);expect(await db.prepare('SELECT status,attempts FROM push_deliveries').first()).toMatchObject({status:'failed',attempts:3});
   await db.prepare("UPDATE push_deliveries SET status='pending',attempts=0,next_at=0").run();await sosApi(req('nearby-alerts',{action:'off'},receiver),configured,now+100000);await dispatchSosPush(configured,data.id,now+100000);expect(deliver).toHaveBeenCalledTimes(3);
   await sosApi(req('sos',{action:'close',id:data.id},cookie),configured,now+100000);await dispatchSosPush(configured,data.id,now+110000);expect(deliver).toHaveBeenCalledTimes(3);
 } finally {deliver.mockRestore();}
});
