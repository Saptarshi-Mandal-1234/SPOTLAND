import { createECDH, generateKeyPairSync } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const subject = process.argv[process.argv.indexOf('--subject') + 1];
if (!process.argv.includes('--subject') || !/^(mailto:[^\s@]+@[^\s@]+|https:\/\/[^\s]+)$/.test(subject || '')) throw new Error('Pass --subject with an approved public mailto contact or HTTPS project URL.');
const file = new URL('../worker/.dev.vars', import.meta.url);
let text = existsSync(file) ? readFileSync(file, 'utf8') : '';
const value = name => text.match(new RegExp(`^${name}=["']?([^"'\\r\\n]+)["']?\\r?$`, 'm'))?.[1];
let publicKey = value('VAPID_PUBLIC_KEY'), privateKey = value('VAPID_PRIVATE_KEY');
if (publicKey || privateKey) {
  if (!publicKey || !privateKey) throw new Error('Incomplete VAPID pair; repair configuration without rotating existing subscriptions.');
  const pair = createECDH('prime256v1'); pair.setPrivateKey(Buffer.from(privateKey, 'base64url'));
  if (pair.getPublicKey().toString('base64url') !== publicKey) throw new Error('VAPID keys do not match. Configuration was not changed.');
} else {
  const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = pair.privateKey.export({ format: 'jwk' }); privateKey = jwk.d;
  publicKey = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]).toString('base64url');
}
for (const [name, data] of Object.entries({ VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey, VAPID_SUBJECT: subject })) {
  text = text.replace(new RegExp(`^${name}=.*(?:\\r?\\n|$)`, 'gm'), '');
  text = text.trimEnd() + `\n${name}="${data}"\n`;
}
writeFileSync(file, text, { mode: 0o600 });
console.log('Web Push configuration saved in git-ignored worker/.dev.vars. Existing matching keys were preserved. Restart the local Worker.');
