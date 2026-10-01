import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const statePath = resolve('.release/rollback.json');
const state = JSON.parse(readFileSync(statePath, 'utf8'));
const target = state.rollback;
const token = process.env.CLOUDFLARE_API_TOKEN;

if (!target?.deploymentId) throw new Error('No captured rollback deployment is available.');
if (!token) {
  console.error('Set CLOUDFLARE_API_TOKEN locally with Pages Write permission, then retry.');
  console.error(`Dashboard fallback: Pages → ${state.project} → Deployments → ${target.url} → Rollback to this deployment.`);
  process.exit(1);
}

const endpoint = `https://api.cloudflare.com/client/v4/accounts/${state.accountId}/pages/projects/${state.project}/deployments/${target.deploymentId}/rollback`;
const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
const payload = await response.json();
if (!response.ok || !payload.success) {
  console.error('Cloudflare rollback failed:', JSON.stringify(payload.errors ?? payload));
  process.exit(1);
}

const health = await fetch(state.productionUrl, { redirect: 'error', signal: AbortSignal.timeout(15_000) });
if (!health.ok) {
  console.error(`Cloudflare accepted the rollback, but ${state.productionUrl} returned HTTP ${health.status}.`);
  process.exit(1);
}

state.lastRollback = { deploymentId: target.deploymentId, url: target.url, restoredAt: new Date().toISOString(), health: 'passed' };
writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
console.log(`Rollback restored and healthy: ${target.url}`);
