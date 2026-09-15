// One Edge profile per site under .auth/<site>/, shared by login.mjs and site.mjs.
//
// A persistent profile rather than an exported cookie file, because a site
// that asks "remember this device?" after a code from the phone writes that
// answer into localStorage and IndexedDB as well as cookies — a cookie jar
// alone would ask for the code again on every run. The directory is
// git-ignored. Nothing in it is ever a password: only what the site itself
// left in the browser after the user signed in by hand.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { REPO_ROOT, siteName } from './common.mjs';

const AUTH_DIR = path.join(REPO_ROOT, '.auth');

export function profileDir(site) {
  return path.join(AUTH_DIR, siteName(site));
}

export function hasProfile(site) {
  return fs.existsSync(profileDir(site));
}

// Chromium drops "session" cookies (no expiry — a login without "remember me")
// when the browser closes, profile or not. So the cookies are also written
// beside the profile when the user finishes signing in, and put back on
// every later open. Still nothing that was typed: only what the site set.
function cookiesFile(site) {
  return path.join(AUTH_DIR, `${siteName(site)}.cookies.json`);
}

export async function keepCookies(context, site) {
  const { cookies } = await context.storageState();
  fs.writeFileSync(cookiesFile(site), JSON.stringify(cookies, null, 2));
  return cookies.length;
}

export async function restoreCookies(context, site) {
  const file = cookiesFile(site);
  if (!fs.existsSync(file)) return 0;
  const cookies = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (cookies.length) await context.addCookies(cookies);
  return cookies.length;
}

/**
 * Open the site's profile: headed for signing in by hand, hidden for pulls.
 * The browser is the Edge already installed on Windows, like the smoke script
 * (PW_CHANNEL=chromium after `npx playwright install chromium` to use that),
 * with the same software-GL flags so a hidden run draws on a machine without a GPU.
 */
export async function openProfile(site, { headed = false } = {}) {
  const dir = profileDir(site);
  fs.mkdirSync(dir, { recursive: true });
  return chromium.launchPersistentContext(dir, {
    channel: process.env.PW_CHANNEL ?? 'msedge',
    headless: !headed,
    viewport: headed ? null : { width: 1280, height: 900 },
    locale: 'he-IL',
    args: headed
      ? ['--start-maximized']
      : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
}
