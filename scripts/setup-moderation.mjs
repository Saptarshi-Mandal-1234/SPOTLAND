import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const path = new URL('../worker/.dev.vars', import.meta.url);
let contents;
try { contents = await readFile(path, 'utf8'); }
catch (error) { if (error.code !== 'ENOENT') throw error; contents = ''; }
const existing = contents.match(/^ADMIN_TOKEN\s*=([^\r\n]*)/m)?.[1].trim().replace(/^(['"])(.*)\1$/, '$2');
if (existing) {
  console.log('Existing local moderator token preserved in worker/.dev.vars.');
} else {
  contents = contents.replace(/^ADMIN_TOKEN\s*=.*(?:\r?\n|$)/gm, '');
  await writeFile(path, `${contents.trimEnd()}\nADMIN_TOKEN="${randomBytes(32).toString('hex')}"\n`);
  console.log('Private local moderator token configured in worker/.dev.vars. Restart the Worker if needed.');
}
