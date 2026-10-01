import { afterEach, expect, it, vi } from 'vitest';
import { testDb } from './test-db.js';
import { venueApi, parseVenues } from './venues';
import { validateVenue, safeWebsite } from '../../shared/venues';
import { cityBookingLinks } from '../../shared/booking-providers';
const now = Date.parse('2026-09-30T12:00:00+05:30');
const input = { name: 'Public comedy room', kind: 'comedy', city: 'Delhi', address: 'Public cultural venue, Delhi', hours: '24/7', lat: 28.61, lon: 77.21, price_note: 'Confirm at venue', website: 'https://venue.test/', booking_links: [{label:'Venue tickets',url:'https://venue.test/tickets'}] };
const make = (path, body, token, origin = 'https://app.test') => new Request('https://api.test'+path,{method:body ? 'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',...(token ? {Authorization:`Bearer ${token}`} : {})},...(body ? {body:JSON.stringify(body)} : {})});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it('validates submissions and rejects unsafe links and invented coordinates', () => {
  expect(validateVenue(input).kind).toBe('comedy'); expect(safeWebsite('javascript:alert(1)')).toBeUndefined(); expect(safeWebsite('https://user:password@venue.test')).toBeUndefined();
  expect(() => validateVenue({...input,booking_links:[{label:'bad',url:'http://venue.test'}]})).toThrow(); expect(() => validateVenue({...input,lat:0})).toThrow(); expect(() => validateVenue(null)).toThrow();
  expect(cityBookingLinks('Delhi')[0].url).toContain('national-capital-region-ncr'); expect(cityBookingLinks('Mumbai')[0].url).toContain('mumbai');
});
it('normalizes all supported OSM sources without copying ratings or invented prices', () => {
  const tags = [{amenity:'cinema'},{amenity:'theatre'},{amenity:'internet_cafe'},{amenity:'community_centre'},{amenity:'studio'},{leisure:'adult_gaming_centre'},{shop:'video_games'}];
  const result = parseVenues({elements:tags.map((tag,i)=>({type:'node',id:i+1,lat:28.6,lon:77.2,tags:{...tag,name:'Venue '+i,website:'javascript:bad',rating:'5'}}))});
  expect(result).toHaveLength(7); expect(result[0].price_note).toBe('Price not supplied.'); expect(result[0].price_updated_at).toBeNull(); expect(result[0].website).toBeUndefined(); expect(result[0]).not.toHaveProperty('rating');
  expect(()=>parseVenues({elements:[],remark:'timeout'})).toThrow(); expect(parseVenues({elements:[null,{type:'bad',id:1,tags:{name:'Invalid',amenity:'cinema'},lat:28,lon:77}]})).toEqual([]);
});
it('keeps pending venues private and publishes only after authorised moderation', async () => {
  vi.useFakeTimers();vi.setSystemTime(now); const env={DB:testDb(),ALLOWED_ORIGIN:'https://app.test',ADMIN_TOKEN:'test'}; vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({elements:[]}))));
  const created=await venueApi(make('/api/venues',{...input,status:'approved'}),env);
  expect(created.status).toBe('pending'); expect((await venueApi(make('/api/venues?lat=28.61&lon=77.21&city=Delhi'),env)).venues.every(v=>v.source==='seed')).toBe(true);
  await expect(venueApi(make('/api/admin/venues'),env)).rejects.toMatchObject({status:401}); const pending=await venueApi(make('/api/admin/venues',undefined,'test'),env);expect(pending).toHaveLength(1);
  await venueApi(make('/api/admin/venues',{id:created.id,status:'approved'},'test'),env); expect((await venueApi(make('/api/venues?lat=28.61&lon=77.21'),env)).venues).toMatchObject([{name:input.name,source:'community',status:'approved'}]);
  expect((await venueApi(make('/api/venues?lat=19&lon=73'),env)).venues).toEqual([]);
  await venueApi(make('/api/admin/venues',{id:created.id,status:'rejected'},'test'),env);expect((await venueApi(make('/api/venues?lat=28.61&lon=77.21'),env)).venues).toEqual([]);
});
it('caches OSM and still returns pilot picks when the provider is down', async () => {
  vi.useFakeTimers();vi.setSystemTime(now); const env={DB:testDb(),ALLOWED_ORIGIN:'https://app.test'};const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({elements:[]})));vi.stubGlobal('fetch',fetch);
  const request=make('/api/venues?lat=28.61&lon=77.21&city=Delhi'); await venueApi(request,env);await venueApi(request,env);expect(fetch).toHaveBeenCalledTimes(1);
  vi.setSystemTime(now+6000);fetch.mockRejectedValueOnce(new Error('offline'));const fallback=await venueApi(make('/api/venues?lat=28.7&lon=77.2&city=Delhi'),env);expect(fallback.venues[0].source).toBe('seed');expect(fallback.warning).toContain('unavailable');
});
it('protects submissions and price-report moderation with rate limits and validation', async () => {
  vi.useFakeTimers();vi.setSystemTime(now);const env={DB:testDb(),ALLOWED_ORIGIN:'https://app.test',ADMIN_TOKEN:'test'};
  await expect(venueApi(make('/api/venues',input,undefined,'https://other.test'),env)).rejects.toMatchObject({status:403}); await venueApi(make('/api/venues',input),env); await expect(venueApi(make('/api/venues',input),env)).rejects.toMatchObject({status:429});
  await expect(venueApi(make('/api/venue-reports',{venueId:'seed:ihc',reason:'short'}),env)).rejects.toMatchObject({status:400});
  await venueApi(make('/api/venue-reports',{venueId:'seed:ihc',reason:'Price needs rechecking at the venue.'}),env);await expect(venueApi(make('/api/venue-reports',{venueId:'seed:ihc',reason:'Duplicate report from same network.'}),env)).rejects.toMatchObject({status:429});
  await expect(venueApi(make('/api/admin/venue-reports'),env)).rejects.toMatchObject({status:401});const reports=await venueApi(make('/api/admin/venue-reports',undefined,'test'),env);expect(reports).toHaveLength(1); await venueApi(make('/api/admin/venue-reports',{id:reports[0].id},'test'),env);expect(await venueApi(make('/api/admin/venue-reports',undefined,'test'),env)).toEqual([]);
});
it('merges a matching OSM venue and pilot directory without duplicate cards or losing sources', async () => {
  const env={DB:testDb(),ALLOWED_ORIGIN:'https://app.test'};vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({elements:[{type:'node',id:1,lat:28.613,lon:77.209,tags:{name:'India Habitat Centre',amenity:'community_centre'}}]}))));
  const result=await venueApi(make('/api/venues?lat=28.6139&lon=77.209&city=Delhi'),env);expect(result.venues).toHaveLength(1);expect(result.venues[0]).toMatchObject({source:'osm',website:'https://www.indiahabitat.org/',directorySourceUrl:'https://indiahabitat.org/Contact_us'});
});
