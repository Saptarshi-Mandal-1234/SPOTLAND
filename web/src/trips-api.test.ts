import { afterEach, expect, test, vi } from 'vitest';
import { reopenTrip, saveTrip, tripRoute } from './trips-api';
import type { TripInput } from '../../shared/trips';
afterEach(()=>vi.unstubAllGlobals());
test('multi-stop requests preserve order and use same-origin cookies for private storage',async()=>{
 const f=vi.fn().mockImplementation(async()=>Response.json({}));vi.stubGlobal('fetch',f);const plan:TripInput={name:'Trip',date:'2026-10-01',mode:'cycle',stops:[{name:'A',address:'',lat:28.6,lon:77.2},{name:'B',address:'',lat:28.7,lon:77.3}]};
 await tripRoute(plan);expect(f.mock.calls[0][0]).toBe('/api/trip-route');expect(JSON.parse(f.mock.calls[0][1].body)).toEqual(plan);await saveTrip('id',plan);expect(JSON.parse(f.mock.calls[1][1].body)).toEqual({action:'save',id:'id',trip:plan});expect(f.mock.calls[1][1].credentials).toBe('same-origin');await reopenTrip('a/b');expect(f.mock.calls[2][0]).toBe('/api/trips?id=a%2Fb');
});
test('uncertain save errors surface and aborted routes do not send',async()=>{
 const f=vi.fn().mockResolvedValue(Response.json({error:'Not confirmed'},{status:503}));vi.stubGlobal('fetch',f);await expect(reopenTrip('id')).rejects.toThrow('Not confirmed');const c=new AbortController();c.abort();await expect(tripRoute({} as TripInput,c.signal)).rejects.toThrow();expect(f).toHaveBeenCalledTimes(1);
});
