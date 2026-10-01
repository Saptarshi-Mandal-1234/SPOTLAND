import { cleanupExpiredData } from './expiry-cleanup';
import type { ReviewPhotoEnv } from './review-photos';

export default {
  async scheduled(_controller: unknown, env: ReviewPhotoEnv) {
    await cleanupExpiredData(env);
    console.log('Expiry cleanup completed.');
  },
};
