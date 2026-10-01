import { expect, it } from 'vitest';
import { reviewPlaceId, validateReview } from './reviews';
it('validates place identifiers, integer ratings and bounded Unicode plain text', () => {
  expect(validateReview({placeId:'node/1',rating:4,text:'  A lovely little stop.  '})).toEqual({placeId:'node/1',rating:4,text:'A lovely little stop.'});
  expect(validateReview({placeId:'seed:delhi-cinema',rating:5,text:'😀'.repeat(10)}).text).toHaveLength(20);
  for (const rating of [0,6,2.5,'5',null]) expect(() => validateReview({placeId:'node/1',rating,text:'Valid review text.'})).toThrow();
  for (const text of ['         ','short','😀'.repeat(5),'x'.repeat(1001),'A review\u0000 with controls']) expect(() => validateReview({placeId:'node/1',rating:5,text})).toThrow();
  for (const id of ['../secret','node/1?token=x','https://example.org',null]) expect(() => reviewPlaceId(id)).toThrow();
});
