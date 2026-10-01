import { expect, test } from 'vitest';
import { approximateDirection, approximateDistance, contactList, decodeArea, encodeArea, nearbyHashes, sosSms } from './sos';
test('broadcast areas are coarse, valid India cells with complete 2 km candidate coverage', () => {
  for (const lat of [8, 28.6, 37.9]) {
    const hash = encodeArea(lat,77.2), area = decodeArea(hash);
    expect(hash).toHaveLength(6); expect(Math.abs(area.lat-lat)).toBeLessThan(.003);
    for (let y=-.025;y<=.025;y+=.005) for (let x=-.03;x<=.03;x+=.005) { const other = encodeArea(lat+y,77.2+x); if (approximateDistance(hash,other)<=2) expect(nearbyHashes(hash)).toContain(other); }
    expect(approximateDirection(hash,hash)).toBe('same approximate area');
  }
  expect(() => decodeArea('ttnfv27')).toThrow(); expect(() => encodeArea(0,0)).toThrow();
});
test('contacts cap, duplicates, unsafe phone input and SMS encoding', () => {
  const contacts = contactList([{name:' Friend ',phone:'+91 90000-00000'}]); expect(contacts).toEqual([{name:'Friend',phone:'+919000000000'}]);
  expect(() => contactList(Array(6).fill(contacts[0]))).toThrow(); expect(() => contactList([contacts[0],contacts[0]])).toThrow(); expect(() => contactList([{name:'X',phone:'123;evil'}])).toThrow();
  const url = sosSms(contacts,'https://example.test/#live=secret'); expect(url).toContain('sms:+919000000000?body='); expect(url).toContain('%23live%3Dsecret'); expect(url).not.toContain('Friend'); expect(sosSms(contacts,'x',true)).toContain('&body=');
});
