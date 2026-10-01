import { beforeEach, expect, it, vi } from 'vitest';
import { cleanupExpiredData } from './expiry-cleanup';
import { cleanupShares } from './live-share';
import { cleanupSos } from './sos';
import { cleanupReviewPhotos } from './review-photos';

vi.mock('./live-share', () => ({ cleanupShares: vi.fn() }));
vi.mock('./sos', () => ({ cleanupSos: vi.fn() }));
vi.mock('./review-photos', () => ({ cleanupReviewPhotos: vi.fn() }));
const env = { ALLOWED_ORIGIN: 'https://example.test' };
beforeEach(() => vi.resetAllMocks());

it('attempts every cleanup even when location cleanup fails', async () => {
  vi.mocked(cleanupShares).mockRejectedValue(new Error('D1 unavailable'));
  await expect(cleanupExpiredData(env)).rejects.toThrow('Expiry cleanup failed');
  expect(cleanupSos).toHaveBeenCalledWith(env);
  expect(cleanupReviewPhotos).toHaveBeenCalledWith(env);
});

it('reports a failed photo sweep rather than marking the cron successful', async () => {
  vi.mocked(cleanupReviewPhotos).mockRejectedValue(new Error('R2 unavailable'));
  await expect(cleanupExpiredData(env)).rejects.toThrow('Expiry cleanup failed');
});
