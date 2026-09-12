// Writes the one file a store app's local pages need and git does not hold:
// www/config.js, the address of the site the shell opens, taken from the
// environment at sync time. The shell's web view loads the live site, so the
// local pages are only the "no connection" page and its retry button — and
// the retry has to know where to go.
//
//   node scripts/mobile-prepare.mjs clinic|portal
//
// Run from the shell's own scripts (`pnpm sync`), never by hand.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = process.argv[2];
if (app !== 'clinic' && app !== 'portal') {
  console.error('usage: node scripts/mobile-prepare.mjs clinic|portal');
  process.exit(2);
}
const variable = app === 'clinic' ? 'HERBALIST_APP_URL' : 'HERBALIST_PORTAL_URL';
const site = process.env[variable];
if (!site) {
  console.error(`${variable} is not set — the address the ${app} app opens, e.g. https://app.example.com`);
  process.exit(2);
}
let origin;
try {
  origin = new URL(site).origin;
} catch {
  console.error(`${variable} is not an address: ${site}`);
  process.exit(2);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const www = path.join(root, 'apps', `mobile-${app}`, 'www');
fs.mkdirSync(www, { recursive: true });
const file = path.join(www, 'config.js');
fs.writeFileSync(file, `// Written by scripts/mobile-prepare.mjs at sync time; not committed.\nwindow.HERBALIST_SITE = ${JSON.stringify(origin)};\n`);
console.log('wrote', path.relative(root, file), '→', origin);
