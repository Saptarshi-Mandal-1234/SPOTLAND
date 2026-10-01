import { expect, test } from 'vitest';
import { shareLink, shareState, validateSharePosition } from './live-share';
test('stale and expired boundaries never label an old position recent', () => {
  const s = { position: { lat: 28, lon: 77, accuracy: 10 }, updatedAt: 1000, expiresAt: 100000 };
  expect(shareState(s, 91000)).toBe('recent'); expect(shareState(s, 91001)).toBe('stale'); expect(shareState(s, 100000)).toBe('expired');
  expect(new URL(shareLink('private', 'https://spotland.pages.dev')).search).toBe(''); expect(new URL(shareLink('private', 'https://spotland.pages.dev')).hash).toBe('#live=private');
  expect(validateSharePosition(s.position)).toEqual(s.position); expect(() => validateSharePosition({ lat: 28, lon: 77, accuracy: Infinity })).toThrow();
});
