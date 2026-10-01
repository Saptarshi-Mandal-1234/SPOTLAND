import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { readUsage, writeUsage } from './usage';
let store: Map<string,string>;
beforeEach(() => { store = new Map(); vi.stubGlobal('localStorage',{getItem:(key:string)=>store.get(key) ?? null,setItem:(key:string,value:string)=>store.set(key,value),removeItem:(key:string)=>store.delete(key)}); });
afterEach(() => vi.unstubAllGlobals());
test('device analytics are opt-in, contain only bounded counters and are deleted on opt-out',() => {
  expect(readUsage()).toBeNull(); expect(writeUsage({})).toBe(true); expect(readUsage()).toEqual({});
  writeUsage({home:3,explore:2000000,...{location:'private',userId:'private'}});
  expect(readUsage()).toEqual({home:3,explore:1000000}); expect([...store.values()][0]).not.toContain('private');
  expect(writeUsage(null)).toBe(true); expect(store.size).toBe(0); expect(readUsage()).toBeNull();
});
test('corrupt, oversized or invalid local counters fail closed',() => {
  for (const raw of ['{','[]','null','{"home":-1}','{"home":1.5}','{"home":"1"}','{"home":1000001}',' '.repeat(501)]) { store.set('spotland:local-usage:v1',raw); expect(readUsage()).toBeNull(); }
});
test('blocked device storage cannot silently enable or clear analytics',() => {
  vi.stubGlobal('localStorage',{getItem:()=>{throw new Error('blocked');},setItem:()=>{throw new Error('blocked');},removeItem:()=>{throw new Error('blocked');}});
  expect(readUsage()).toBeNull(); expect(writeUsage({})).toBe(false); expect(writeUsage(null)).toBe(false);
});
