import { spawn, spawnSync } from 'node:child_process';
const migration = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'd1', 'migrations', 'apply', 'travelapp', '--local', '--config', 'worker/wrangler.jsonc'], { stdio: 'inherit' });
if (migration.status !== 0) process.exit(migration.status || 1);
const cli = (file, args) => spawn(process.execPath, [file, ...args], { stdio: 'inherit' });
const processes = [cli('node_modules/vite/bin/vite.js', ['--config', 'web/vite.config.ts']), cli('node_modules/wrangler/bin/wrangler.js', ['dev', '--config', 'worker/wrangler.jsonc', '--port', '8787'])];
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; for (const child of processes) child.kill(); process.exitCode = code; }
for (const child of processes) { child.on('error', () => stop(1)); child.on('exit', code => stop(code ?? 1)); }
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
