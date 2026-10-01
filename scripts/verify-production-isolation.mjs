import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

if (!process.argv.includes('--run-production')) throw new Error('Requires --run-production: creates two disposable production fixtures and removes them afterward.');
const origin = 'https://spotland.pages.dev';
const configPath = 'worker/wrangler.production.jsonc';
const config = JSON.parse(readFileSync(configPath, 'utf8'));
assert.equal(config.name, 'travelapp-api');
assert.equal(config.vars.ALLOWED_ORIGIN, origin);
assert.equal(config.d1_databases[0].database_id, '345c1b77-e110-4e37-9c88-51810db8495c');
mkdirSync('worker/.wrangler', { recursive: true });
mkdirSync('reports/release-checks', { recursive: true });
const run = randomUUID(), sqlFile = `worker/.wrangler/isolation-${run}.sql`;
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const profiles = ['A', 'B'].map(name => ({ name, id: randomUUID(), token: randomBytes(32).toString('base64url') }));
const [a, b] = profiles, placeId = `seed:isolation-${run}`, tripId = randomUUID();
const checks = [];
function sql(text) {
  writeFileSync(sqlFile, text, { mode: 0o600 });
  const output = execFileSync(process.execPath, [resolve('node_modules/wrangler/bin/wrangler.js'), 'd1', 'execute', 'travelapp', '--remote', '--config', configPath, '--command', text, '--json'], { encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] });
  const json = output.match(/(?:^|\n)(\[[\s\S]*\])\s*$/)?.[1];
  if (!json) throw new Error('D1 result was not JSON; cleanup SQL is retained in the ignored fixture file.');
  return JSON.parse(json);
}
async function request(profile, path, data, status = 200, requestOrigin = origin) {
  const response = await fetch(origin + '/api' + path, { method: data ? 'POST' : 'GET', headers: { Origin: requestOrigin, ...(profile ? { Cookie: `__Host-spotland_session=${profile.token}` } : {}), ...(data ? { 'Content-Type': 'application/json' } : {}) }, body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, status, `${path}: expected HTTP ${status}, received ${response.status}`);
  return response.json();
}
function passed(label) { checks.push(label); console.log('PASS: ' + label); }
let created = false, failure;
try {
  const now = Date.now();
  // Fixtures have no access to real users and expire even if cleanup is interrupted.
  created = true;
  sql(profiles.map(p => `INSERT INTO users(id,google_sub,name,created_at) VALUES (${quote(p.id)},${quote('verification:' + p.id)},${quote('Isolation fixture ' + p.name)},${now}); INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (${quote(createHash('sha256').update(p.token).digest('hex'))},${quote(p.id)},${now + 600000});`).join('\n'));
  assert.equal((await request(a, '/auth/session')).user.id, a.id);
  assert.equal((await request(b, '/auth/session')).user.id, b.id);
  const place = { id: placeId, name: 'Private favorite A', category: 'park', address: 'Synthetic test fixture', hours: 'Not supplied', lat: 28.6129, lon: 77.2295 };
  await request(a, '/favorites', { action: 'save', place });
  assert.deepEqual(await request(b, '/favorites'), []);
  await request(b, '/favorites', { action: 'remove', id: placeId });
  assert.equal((await request(a, '/favorites'))[0].place.name, place.name);
  await request(b, '/favorites', { action: 'save', place: { ...place, name: 'Private favorite B' } });
  assert.equal((await request(a, '/favorites'))[0].place.name, 'Private favorite A');
  assert.equal((await request(b, '/favorites'))[0].place.name, 'Private favorite B');
  passed('favorites are scoped independently for the same place');
  const trip = { name: 'Isolation test trip', date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Calcutta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()), mode: 'walk', stops: [{ name: 'Test A', address: 'Synthetic', lat: 28.6129, lon: 77.2295 }, { name: 'Test B', address: 'Synthetic', lat: 28.6118, lon: 77.2195 }] };
  await request(a, '/trips', { action: 'save', id: tripId, trip });
  assert.deepEqual(await request(b, '/trips'), []);
  await request(b, '/trips?id=' + tripId, null, 404);
  await request(b, '/trips', { action: 'remove', id: tripId });
  assert.deepEqual((await request(a, '/trips?id=' + tripId)).stops, trip.stops);
  await request(b, '/trips', { action: 'save', id: tripId, trip }, 409);
  assert.equal((await request(a, '/trips?id=' + tripId)).name, trip.name);
  passed('another account cannot read, delete or overwrite a trip');
  const review = await request(a, '/reviews', { action: 'save', placeId, rating: 4, text: 'Synthetic isolation verification, not a visitor review.' });
  const path = '/reviews?placeId=' + encodeURIComponent(placeId);
  assert.equal((await request(b, path)).mine, null);
  await request(b, '/reviews', { action: 'remove', id: review.id });
  assert.equal((await request(a, path)).mine.id, review.id);
  const other = await request(b, '/reviews', { action: 'save', placeId, rating: 3, text: 'Separate synthetic account verification.' });
  assert.notEqual(review.id, other.id);
  assert.equal((await request(a, path)).mine.id, review.id);
  assert.equal((await request(b, path)).mine.id, other.id);
  const publicReviews = await request(null, path);
  assert.equal(publicReviews.mine, null);
  assert.ok(publicReviews.reviews.every(row => !('userId' in row) && !('user_id' in row)));
  passed('review ownership stays private while intended public reviews remain readable');
  await request(a, '/favorites', { action: 'remove', id: placeId }, 403, 'https://invalid-origin.example');
  await request(null, '/favorites', null, 401);
  await request(null, '/trips', null, 401);
  passed('origin and authentication gates reject unauthorized access');
  await request(a, '/auth/logout', {});
  assert.equal((await request(a, '/auth/session')).user, null);
  await request(a, '/favorites', null, 401);
  await request(a, '/trips', null, 401);
  passed('logout revokes the same token for subsequent requests');
} catch (error) { failure = error; }
finally {
  if (created) {
    const ids = profiles.map(p => quote(p.id)).join(',');
    sql(`DELETE FROM users WHERE id IN (${ids}) AND google_sub=('verification:' || id);`);
    const result = sql(`SELECT COUNT(*) AS remaining FROM users WHERE id IN (${ids}); SELECT COUNT(*) AS remaining FROM reviews WHERE place_id=${quote(placeId)}; SELECT COUNT(*) AS remaining FROM trips WHERE id=${quote(tripId)}; SELECT COUNT(*) AS remaining FROM favorites WHERE place_id=${quote(placeId)};`);
    assert.ok(result.every(query => query.results[0].remaining === 0), 'Fixture cleanup must remove only this run’s records');
    passed('both fixture accounts and associated records removed');
  }
  writeFileSync('reports/release-checks/account-isolation.json', JSON.stringify({ reviewedAt: new Date().toISOString(), origin, method: 'Production HTTP API with two disposable D1 session fixtures; does not repeat Google OAuth/browser account switching', checks, passed: !failure }, null, 2));
}
if (failure) throw failure;
