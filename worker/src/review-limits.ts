import { hashToken } from './accounts';
import { ProviderError } from './providers';
import type { Database } from './db';

export async function reviewLimit(db: Database, identity: string, scope: string, cap: number, cooldown: number, now: number) {
  const key = await hashToken(`reviews:${scope}:${Math.floor(now / 86400000)}:${identity}`);
  await db.prepare('DELETE FROM submission_limits WHERE expires_at<=?').bind(now).run();
  const row = await db.prepare('INSERT INTO submission_limits (key,count,next_at,expires_at) VALUES (?,1,?,?) ON CONFLICT(key) DO UPDATE SET count=count+1,next_at=excluded.next_at WHERE count<? AND next_at<=? RETURNING key').bind(key,now+cooldown,now+86400000,cap,now).first();
  if (!row) throw new ProviderError('Review limit reached. Wait before retrying; daily limits also apply.',429);
}
