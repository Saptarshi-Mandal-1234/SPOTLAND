import { readCache, reserveProvider, writeCache, type Database } from './db';
import { ProviderError } from './providers';
export interface GoogleEnv { GOOGLE_CLIENT_ID?: string; GOOGLE_JWKS_URL?: string }
interface GoogleKey extends JsonWebKey { kid: string }
const invalid = () => new ProviderError('Google sign-in could not be verified. Try signing in again.', 401);
function decode(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw invalid();
  try { return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)); } catch { throw invalid(); }
}
export function googleClientId(env: GoogleEnv) { return /^\d+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(env.GOOGLE_CLIENT_ID || '') ? env.GOOGLE_CLIENT_ID! : ''; }
async function keys(db: Database, env: GoogleEnv, kid: string, now: number): Promise<GoogleKey[]> {
  const cacheKey = 'google-jwks:v1';
  const cached = await readCache(db, cacheKey, now) as { keys?: GoogleKey[] } | null;
  if (Array.isArray(cached?.keys) && cached.keys.some(key => key.kid === kid)) return cached.keys;
  if (!await reserveProvider(db, 'google-jwks', 60000, now)) throw new ProviderError('Sign-in verification is busy. Retry in a minute.', 429);
  // A configured endpoint must still be Google's official key host; tokens cannot supply URLs.
  const endpoint = env.GOOGLE_JWKS_URL || 'https://www.googleapis.com/oauth2/v3/certs';
  if (endpoint !== 'https://www.googleapis.com/oauth2/v3/certs') throw new ProviderError('Google key endpoint configuration is invalid.', 503);
  let response: Response;
  // Workers supports manual redirects; non-2xx responses below reject redirects.
  try { response = await fetch(endpoint, { signal: AbortSignal.timeout(10000), redirect: 'manual' }); } catch { throw new ProviderError('Google verification is unavailable. Retry shortly.', 503); }
  if (!response.ok) throw new ProviderError('Google verification is unavailable. Retry shortly.', 503);
  const raw = await response.text(); if (raw.length > 32768) throw new ProviderError('Google key response is invalid.', 503);
  let data: { keys?: GoogleKey[] }; try { data = JSON.parse(raw); } catch { throw new ProviderError('Google key response is invalid.', 503); }
  if (!Array.isArray(data.keys) || !data.keys.length || data.keys.length > 10 || data.keys.some(key => key.kty !== 'RSA' || typeof key.kid !== 'string' || typeof key.n !== 'string' || typeof key.e !== 'string')) throw new ProviderError('Google key response is invalid.', 503);
  const maxAge = Number(response.headers.get('Cache-Control')?.match(/max-age=(\d+)/)?.[1] || 300);
  await writeCache(db, cacheKey, data, Math.min(maxAge, 86400) * 1000, now);
  return data.keys;
}
export async function verifyGoogle(db: Database, env: GoogleEnv, token: unknown, nonce: string, now = Date.now()) {
  if (!googleClientId(env)) throw new ProviderError('Google sign-in is not configured yet.', 503);
  if (typeof token !== 'string' || token.length > 8192) throw invalid();
  const parts = token.split('.'); if (parts.length !== 3) throw invalid();
  let header, claims;
  try { header = JSON.parse(new TextDecoder().decode(decode(parts[0]))); claims = JSON.parse(new TextDecoder().decode(decode(parts[1]))); } catch { throw invalid(); }
  if (!header || header.alg !== 'RS256' || typeof header.kid !== 'string' || header.kid.length > 200 || !claims || typeof claims !== 'object' || Array.isArray(claims)) throw invalid();
  const seconds = now / 1000;
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss) || claims.aud !== env.GOOGLE_CLIENT_ID || (claims.azp !== undefined && claims.azp !== env.GOOGLE_CLIENT_ID) || typeof claims.exp !== 'number' || !Number.isFinite(claims.exp) || claims.exp <= seconds || typeof claims.iat !== 'number' || !Number.isFinite(claims.iat) || claims.iat > seconds + 60 || claims.exp - claims.iat > 7200 || claims.nonce !== nonce || typeof claims.sub !== 'string' || !/^[A-Za-z0-9_-]{1,255}$/.test(claims.sub)) throw invalid();
  const key = (await keys(db, env, header.kid, now)).find(key => key.kid === header.kid); if (!key) throw invalid();
  try {
    const imported = await crypto.subtle.importKey('jwk', key, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', imported, decode(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`))) throw invalid();
  } catch { throw invalid(); }
  return { sub: claims.sub as string, name: typeof claims.name === 'string' ? claims.name.trim().slice(0, 80) || 'Traveller' : 'Traveller' };
}
