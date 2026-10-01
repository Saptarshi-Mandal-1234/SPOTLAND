import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { clearCollection, clearOfflineData, readArea, readCollection, saveArea, saveCollection } from './offline';
import { watchConnection } from './useOnline';
const place = { id: 'node/1', name: 'Public cafe', category: 'cafe' as const, address: 'Delhi', hours: '24/7', lat: 28.6139, lon: 77.209 };
let data: Map<string, string>;
beforeEach(() => { data = new Map(); vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) }); vi.stubGlobal('window', { dispatchEvent: vi.fn() }); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it('stores a coarse area and public places only, bounded to 500', () => {
  const privateExtra = { ...place, token: 'never-store', precisePosition: [1, 2] };
  expect(saveArea(place, 2000, Array.from({ length: 501 }, () => privateExtra), 'Delhi')).toBe(true);
  expect(readArea()).toMatchObject({ center: { lat: 28.61, lon: 77.21 }, radius: 2000, region: 'Delhi' });
  expect(readArea()?.places).toHaveLength(500);
  expect(data.get('spotland-offline-v1:area')).not.toContain('never-store');
});
it('expires and removes cached area and collection after seven days', () => {
  vi.useFakeTimers(); saveArea(place, 2000, [place]); saveCollection('owner-a', [{ place, savedAt: Date.now() }]);
  vi.advanceTimersByTime(7 * 86400000); expect(readArea()).toBeNull(); expect(readCollection()).toBeNull(); expect(data.size).toBe(0);
});
it('keeps the collection owner distinct and strips unexpected fields', () => {
  const extendedPlace = { ...place, credential: 'secret' }; saveCollection('owner-a', [{ place: extendedPlace, savedAt: Date.now() }]);
  expect(readCollection()?.owner).toBe('owner-a'); expect(data.get('spotland-offline-v1:favorites')).not.toContain('secret');
  saveCollection('owner-b', []); expect(readCollection()).toMatchObject({ owner: 'owner-b', rows: [] });
  clearCollection(); expect(readCollection()).toBeNull();
});
it('rejects corrupted, unsafe or oversized snapshots', () => {
  data.set('spotland-offline-v1:area', '{'); expect(readArea()).toBeNull();
  saveCollection('owner', [{ place, savedAt: Date.now() }]); const value = JSON.parse(data.get('spotland-offline-v1:favorites')!); value.rows[0].place.sourceUrl = 'javascript:alert(1)'; data.set('spotland-offline-v1:favorites', JSON.stringify(value)); expect(readCollection()).toBeNull();
  expect(saveCollection('owner', Array.from({ length: 201 }, () => ({ place, savedAt: Date.now() })))).toBe(false);
  saveArea(place, 2000, [place]); const area = JSON.parse(data.get('spotland-offline-v1:area')!); area.center.lat = 90; data.set('spotland-offline-v1:area', JSON.stringify(area)); expect(readArea()).toBeNull();
});
it('fails visibly when storage is blocked and clears only offline copies', () => {
  data.set('contacts', 'keep'); data.set('theme', 'dark'); saveArea(place, 2000, [place]); saveCollection('owner', []);
  expect(clearOfflineData()).toBe(true); expect([...data.keys()]).toEqual(['contacts', 'theme']); expect(window.dispatchEvent).toHaveBeenCalled();
  vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('quota'); }, removeItem: () => { throw new Error('blocked'); } });
  expect(readCollection()).toBeNull(); expect(readArea()).toBeNull(); expect(clearCollection()).toBe(false); expect(saveArea(place, 2000, [place])).toBe(false); expect(clearOfflineData()).toBe(false);
});
it('observes connection loss and reconnect, and cleans up listeners', () => {
  const target = new EventTarget(); vi.stubGlobal('window', target); const update = vi.fn(); const stop = watchConnection(update);
  target.dispatchEvent(new Event('offline')); target.dispatchEvent(new Event('online')); expect(update).toHaveBeenCalledTimes(2);
  stop(); target.dispatchEvent(new Event('online')); expect(update).toHaveBeenCalledTimes(2);
});


