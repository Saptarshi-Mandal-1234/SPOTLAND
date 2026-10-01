import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const project = 'spotland';
const statePath = resolve('.release/rollback.json');
const wrangler = process.platform === 'win32' ? 'node_modules/.bin/wrangler.cmd' : 'node_modules/.bin/wrangler';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    ...options,
  });
}

function show(command, args) {
  try {
    return run(command, args);
  } catch (error) {
    process.stdout.write(error.stdout ?? '');
    process.stderr.write(error.stderr ?? '');
    throw error;
  }
}

function requireCleanTree() {
  const status = show('git', ['status', '--porcelain']).trim();
  if (status) throw new Error('Commit or stash local changes before a production release.');
}

function pagesDeployments() {
  return JSON.parse(show(wrangler, ['pages', 'deployment', 'list', '--project-name', project, '--json']));
}

async function health(url) {
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Live health check failed with HTTP ${response.status}.`);
}

async function main() {
  requireCleanTree();
  show(npm, ['run', 'release:verify']);

  const current = pagesDeployments().find((deployment) => deployment.Environment === 'Production');
  if (!current?.Id || !current.Deployment) throw new Error('Could not identify the current production Pages deployment.');

  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  state.rollback = {
    deploymentId: current.Id,
    url: current.Deployment,
    sourceCommit: current.Source || null,
    capturedAt: new Date().toISOString(),
    verification: 'Captured automatically immediately before the next managed Pages release.',
  };
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);

  const commit = show('git', ['rev-parse', '--short', 'HEAD']).trim();
  show(wrangler, [
    'pages', 'deploy', 'web/dist', '--project-name', project, '--branch', 'main',
    '--commit-hash', commit, '--commit-message', `Managed SPOTLAND release ${commit}`,
  ]);
  const candidate = pagesDeployments().find((deployment) => deployment.Environment === 'Production');
  const candidateUrl = candidate?.Deployment;
  if (!candidateUrl) throw new Error('Cloudflare did not return a production URL for the new deployment.');
  await health('https://spotland.pages.dev');
  await health(candidateUrl);

  state.lastCandidate = { commit, url: candidateUrl, deployedAt: new Date().toISOString(), health: 'passed' };
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  console.log(`Release is live. Rollback target: ${state.rollback.url}`);
  console.log('Commit the updated .release/rollback.json with the release record.');
}

main().catch((error) => {
  console.error(`Release stopped: ${error.message}`);
  process.exit(1);
});
