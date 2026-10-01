import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, test, vi } from 'vitest';

function fixture() {
 const listeners={},showNotification=vi.fn().mockResolvedValue(undefined),openWindow=vi.fn();
 const self={addEventListener:(type,handler)=>{listeners[type]=handler;},registration:{showNotification},location:{origin:'https://spotland.pages.dev'},clients:{matchAll:vi.fn().mockResolvedValue([]),openWindow}};
 runInNewContext(readFileSync(new URL('../../web/public/sos-push.js',import.meta.url),'utf8'),{self,Date,URL});
 return {listeners,showNotification,openWindow};
}
test('encrypted SOS/test notifications never display private payload fields; delayed pushes show a neutral expiry',async()=>{
 const f=fixture(),id=crypto.randomUUID();
 for(const [type,expiresAt,title] of [['spotland-sos',Date.now()+60000,'SPOTLAND nearby SOS'],['spotland-push-test',Date.now()+60000,'SPOTLAND notification test'],['spotland-sos',Date.now()-1,'SPOTLAND notification expired']]) {
  let pending;f.listeners.push({data:{json:()=>({type,id,expiresAt,lat:28.6,phone:'private-phone',link:'private-link'})},waitUntil:p=>{pending=p;}});await pending;
  expect(f.showNotification.mock.calls.at(-1)[0]).toBe(title);expect(JSON.stringify(f.showNotification.mock.calls.at(-1))).not.toContain('private');
 }
 f.listeners.push({data:{json:()=>({type:'spotland-sos',id:'invalid',expiresAt:Date.now()+60000})},waitUntil:()=>{throw new Error('Invalid notification');}});
 expect(f.showNotification).toHaveBeenCalledTimes(3);
});
test('notification click opens SOS without a private link; expired notification does not reopen an alert',async()=>{
 const f=fixture();let pending;const close=vi.fn();
 f.listeners.notificationclick({notification:{close,data:{expiresAt:Date.now()+60000}},waitUntil:p=>{pending=p;}});await pending;expect(f.openWindow).toHaveBeenCalledWith('/#sos');
 f.listeners.notificationclick({notification:{close,data:{expiresAt:Date.now()-1}},waitUntil:()=>{throw new Error('Expired alert');}});expect(f.openWindow).toHaveBeenCalledTimes(1);expect(close).toHaveBeenCalledTimes(2);
});
