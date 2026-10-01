export interface SharePosition { lat: number; lon: number; accuracy: number }
export interface ShareSnapshot { position: SharePosition; updatedAt: number; expiresAt: number }
export interface CreatedShare extends ShareSnapshot { token: string }
export interface SenderShare { id: string; token: string; expiresAt: number }
export const shareHours = [1, 4, 8] as const;
export const shareInterval = 30000;
export const shareStaleAfter = 90000;
export function validateSharePosition(value: unknown): SharePosition {
  const p = value as SharePosition | null;
  if (!p || typeof p !== 'object' || !Number.isFinite(p.lat) || !Number.isFinite(p.lon) || !Number.isFinite(p.accuracy) || p.lat < 6 || p.lat > 38 || p.lon < 68 || p.lon > 98 || p.accuracy < 0 || p.accuracy > 100000) throw new Error('Choose a valid location in India.');
  return { lat: p.lat, lon: p.lon, accuracy: p.accuracy };
}
export function shareState(snapshot: ShareSnapshot, now = Date.now()) { return now >= snapshot.expiresAt ? 'expired' : now - snapshot.updatedAt > shareStaleAfter ? 'stale' : 'recent'; }
export function shareLink(token: string, origin: string) { return `${origin}/#live=${token}`; }
