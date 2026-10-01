import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const documentPath = resolve('DEVELOPMENT.md');
const contents = readFileSync(documentPath, 'utf8');
const requiredHeadings = [
  '# SPOTLAND development guide',
  '## Product and architecture',
  '## UI and UX system',
  '## Services and integrations',
  '## Iteration workflow',
  '## Iteration log',
];

const missing = requiredHeadings.filter((heading) => !contents.includes(heading));
if (missing.length > 0) {
  console.error(`DEVELOPMENT.md is missing required sections: ${missing.join(', ')}`);
  process.exit(1);
}

if (!/^Last updated: \d{4}-\d{2}-\d{2}/m.test(contents) || !/^\| \d{4}-\d{2}-\d{2} \|/m.test(contents)) {
  console.error('DEVELOPMENT.md needs a Last updated date and at least one dated iteration-log entry.');
  process.exit(1);
}

console.log('DEVELOPMENT.md has the required architecture, UX, service and iteration record.');
