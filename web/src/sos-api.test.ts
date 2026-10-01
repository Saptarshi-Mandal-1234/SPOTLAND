import { afterEach, expect, test, vi } from 'vitest';
import { createSos, closeSos, type SosIntent } from './sos-api';
afterEach(() => vi.unstubAllGlobals());
test('broadcast request omits private share nonce, contacts and precise position; failed closure surfaces errors',async()=>{
 const fetchMock=vi.fn().mockResolvedValue(Response.json({}));vi.stubGlobal('fetch',fetchMock);
 const intent:SosIntent={id:'id',startedAt:1,broadcast:true,closing:false,geohash:'ttnfv2',shareId:'share-id',shareNonce:'private-secret',shareExpiresAt:2};await createSos(intent);
 expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({action:'create',id:'id',startedAt:1,geohash:'ttnfv2',shareId:'share-id',consent:true});expect(fetchMock.mock.calls[0][1].credentials).toBe('same-origin');
 fetchMock.mockResolvedValue(Response.json({error:'Offline'},{status:503}));await expect(closeSos('id')).rejects.toThrow('Offline');
});
