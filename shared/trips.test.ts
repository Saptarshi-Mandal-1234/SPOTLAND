import { expect, test } from 'vitest';
import { moveStop, tripDayHours, validateTrip } from './trips';
import type { Forecast } from './weather';
const stops=[{name:'A',address:'',lat:28.6,lon:77.2},{name:'B',address:'',lat:28.61,lon:77.21},{name:'C',address:'',lat:28.62,lon:77.22}];
test('trip validation preserves order, removes unknown fields and rejects unsafe/bad/oversized trips',()=>{
 expect(validateTrip({name:' Trip ',date:'2026-10-01',mode:'walk',stops})).toEqual({name:'Trip',date:'2026-10-01',mode:'walk',stops});
 for (const patch of [{date:'2026-02-30'},{date:'tomorrow'},{mode:'air'},{stops:[]},{stops:Array(9).fill(stops[0])},{stops:[stops[0],stops[0]]},{stops:[stops[0],{...stops[1],lat:0}]},{stops:[stops[0],{...stops[1],lat:19,lon:72}]},{name:''}]) expect(()=>validateTrip({name:'Trip',date:'2026-10-01',mode:'walk',stops,...patch})).toThrow();
 const unsafe={...stops[0],lat:'28.6'};expect(()=>validateTrip({name:'Trip',date:'2026-10-01',mode:'drive',stops:[unsafe,stops[1]]})).toThrow();
});
test('visible reorder controls preserve all stops and guard both boundaries without mutating original',()=>{
 expect(moveStop(stops,1,-1)).toEqual([stops[1],stops[0],stops[2]]);expect(moveStop(stops,1,1)).toEqual([stops[0],stops[2],stops[1]]);expect(moveStop(stops,0,-1)).toEqual(stops);expect(moveStop(stops,2,1)).toEqual(stops);expect(stops[0].name).toBe('A');
});
test('trip weather uses IST date boundaries, excludes elapsed hours and never substitutes another day',()=>{
 const times=['2026-09-30T18:00Z','2026-09-30T19:00Z','2026-10-01T18:00Z','2026-10-01T19:00Z'].map(Date.parse);
 const forecast={fetchedAt:times[0],hours:times.map(time=>({time}))} as Forecast;
 expect(tripDayHours(forecast,'2026-10-01',times[0]).map(h=>h.time)).toEqual(times.slice(1,3));expect(tripDayHours(forecast,'2026-10-01',times[2]).map(h=>h.time)).toEqual([times[2]]);expect(tripDayHours(forecast,'2026-12-01',times[0])).toEqual([]);
});
