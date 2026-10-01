import { cleanupShares } from './live-share';
import { cleanupSos } from './sos';
import { cleanupReviewPhotos, type ReviewPhotoEnv } from './review-photos';

export async function cleanupExpiredData(env: ReviewPhotoEnv) {
  const results = await Promise.allSettled([
    cleanupShares(env), cleanupSos(env), cleanupReviewPhotos(env),
  ]);
  const errors = results.filter(result => result.status === 'rejected');
  if (errors.length) throw new AggregateError(errors.map(result => result.reason), 'Expiry cleanup failed; retry on the next scheduled run.');
}
