#!/usr/bin/env node
// Sign in to a website by hand, once, and keep the session for site.mjs.
//
// Nothing here reads, asks for or stores a password. A real Edge window opens
// with its own profile under .auth/<site>/ (git-ignored); you sign in to the
// site the way you always do — password, code from the phone, "remember this
// device" — and press Enter here when you are in. From then on
// `site.mjs --site=<name>` opens the same profile, already signed in, until
// the site itself signs it out.
//
//   node scripts/pull/login.mjs --site=my-bank --url=https://example.com/login
import { ask } from '../medicine/lib/prompt.mjs';
import { parseArgs, siteName } from './lib/common.mjs';
import { keepCookies, openProfile, profileDir } from './lib/browser.mjs';

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.site || !args.url) {
  console.log(`usage: node scripts/pull/login.mjs --site=<name> --url=<login page>

  --site   a short name for the site (letters, digits, dashes); the session is kept under .auth/<name>/
  --url    the page to open — usually the site's login page

Sign in inside the window that opens, then press Enter in this terminal. Delete .auth/<name>/ to sign out.`);
  process.exit(args.help ? 0 : 1);
}

const site = siteName(args.site);
const url = String(args.url);
const context = await openProfile(site, { headed: true });
const page = context.pages()[0] ?? (await context.newPage());
await page.goto(url, { waitUntil: 'domcontentloaded' }).catch((error) => {
  console.log(`could not open ${url}: ${error.message}`);
});
console.log(`A browser window is open on ${url}.`);
console.log(
  'Sign in there as you normally would — the password goes into the site, never into this terminal.',
);
await ask('When you are signed in, press Enter here to keep the session: ');
// The user may already have closed the window; the profile on disk is what matters.
const kept = await keepCookies(context, site).catch(() => 0);
await context.close().catch(() => {});
console.log(`Session kept in ${profileDir(site)} (${kept} cookies)`);
if (!kept) console.log('no cookies were set — did the sign-in finish before Enter was pressed?');
console.log(`From now on: node scripts/pull/site.mjs --site=${site} --url=<a page of the site>`);
