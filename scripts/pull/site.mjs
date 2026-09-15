#!/usr/bin/env node
// Open a page with a saved session and keep what it shows: the HTML, the
// text, a screenshot, every link on it, and every JSON answer the page fetched
// while loading — which, on most sites without an official API, is the data
// itself in a form a script can read. Output goes under test-results/pull/
// (git-ignored): it is your own account's data and stays on this computer.
//
//   node scripts/pull/site.mjs --site=my-bank --url=https://example.com/account
//
//   --site        the name given to login.mjs
//   --url         the page to open
//   --out=<dir>   where to write (default test-results/pull/<site>/<run>/)
//   --scroll=<n>  scroll to the bottom n times, for lists that load as you scroll
//   --wait=<ms>   extra time to wait after the page settles (default 2000)
//   --wait-for=<css selector>  wait until this appears first (a table, a list…)
//   --show        watch the browser instead of running it hidden
import fs from 'node:fs';
import path from 'node:path';
import { outputDir, parseArgs, siteName, writeJson } from './lib/common.mjs';
import { hasProfile, openProfile, restoreCookies } from './lib/browser.mjs';

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.site || !args.url) {
  console.log(`usage: node scripts/pull/site.mjs --site=<name> --url=<page> [--out=<dir>] [--scroll=<n>] [--wait=<ms>] [--wait-for=<selector>] [--show]

  --site      the name given to login.mjs (the session under .auth/<name>/)
  --url       the page to open
  --out       where to write; default test-results/pull/<name>/<run>/
  --scroll    scroll to the bottom this many times, for lists that load as you scroll
  --wait      milliseconds to wait after the page settles (default 2000)
  --wait-for  a CSS selector to wait for before saving
  --show      watch the browser instead of running it hidden

Saves page.html, page.txt, page.png, links.json, index.json and json/ (every JSON answer the page fetched).`);
  process.exit(args.help ? 0 : 1);
}

const site = siteName(args.site);
const url = String(args.url);
if (!hasProfile(site)) {
  console.log(
    `no session for "${site}" yet — first: node scripts/pull/login.mjs --site=${site} --url=<login page>`,
  );
  process.exit(1);
}

const out = outputDir(site, args.out);
const context = await openProfile(site, { headed: Boolean(args.show) });
await restoreCookies(context, site);
const page = context.pages()[0] ?? (await context.newPage());

// JSON answers as they arrive, numbered in order and indexed by the address
// they came from, so index.json says which file holds what.
const captured = [];
const pendingBodies = new Set();
page.on('response', (response) => {
  const request = response.request();
  if (!['xhr', 'fetch'].includes(request.resourceType())) return;
  if (!/json/i.test(response.headers()['content-type'] ?? '')) return;
  const job = response
    .json()
    .then((body) => {
      const n = captured.length + 1;
      const address = new URL(response.url());
      const slug = address.pathname
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60);
      const file = `json/${String(n).padStart(3, '0')}-${address.hostname}${slug ? `-${slug}` : ''}.json`;
      captured.push({
        n,
        method: request.method(),
        url: address.origin + address.pathname,
        status: response.status(),
        file,
      });
      writeJson(out, file, body);
    })
    .catch(() => {
      // Not JSON after all, or the body was gone by the time we asked.
    })
    .finally(() => pendingBodies.delete(job));
  pendingBodies.add(job);
});

const startedAt = Date.now();
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
if (args['wait-for']) {
  await page
    .waitForSelector(String(args['wait-for']), { timeout: 60_000 })
    .catch(() =>
      console.log(`"${args['wait-for']}" did not appear within a minute — saving what is there`),
    );
}
const scrolls = Number(args.scroll ?? 0);
for (let i = 0; i < scrolls; i++) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(1500);
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
}
await page.waitForTimeout(Number(args.wait ?? 2000));

const opened = page.url();
const title = await page.title();
const html = await page.content();
const text = await page.evaluate(() => document.body?.innerText ?? '');
const links = await page.evaluate(() =>
  Array.from(document.querySelectorAll('a[href]')).map((a) => ({
    text: a.textContent.trim().slice(0, 200),
    href: a.href,
  })),
);
fs.writeFileSync(path.join(out, 'page.html'), html);
fs.writeFileSync(path.join(out, 'page.txt'), text);
await page.screenshot({ path: path.join(out, 'page.png'), fullPage: true }).catch(() => {});
writeJson(out, 'links.json', links);
await Promise.allSettled([...pendingBodies]);
await context.close();
writeJson(out, 'index.json', {
  site,
  requested: url,
  opened,
  title,
  at: new Date().toISOString(),
  ms: Date.now() - startedAt,
  json: captured,
});

// The usual sign that the session is gone: the site sent us to its login page.
const asked = new URL(url);
const landed = new URL(opened);
const loginish =
  /login|signin|sign-in|auth|session/i.test(landed.pathname) ||
  /log ?in|sign ?in|התחברות|כניסה/i.test(title);
if (loginish && !/login|signin|sign-in|auth/i.test(asked.pathname)) {
  console.log(
    `the page that opened looks like a login page (${opened}) — the session may have expired; run login.mjs --site=${site} again`,
  );
}
console.log(out);
console.log(
  `  page.html, page.txt, page.png, links.json (${links.length} links), ${captured.length} JSON answers in json/`,
);
