// The screenshots on the public home page (app/[locale]/(site)/about), taken
// from the sandbox clinic — fictional patients only — with the same headless
// Edge the smoke runs in. Run against a built app after a visible change to
// the screens shown:  SMOKE_BASE_URL=http://localhost:3002 node scripts/render-site-shots.mjs
//
// Refuses to run without the sandbox banner, and hides that banner (and the
// first-steps card, and the home-screen hint) in the pictures themselves.
// Output: apps/web/public/site/<screen>-<locale>.webp (or .jpg without sharp).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { loadSharp } from './shrink-herb-images.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = readEnv(path.join(root, 'apps', 'web', '.env.test.local'));
const baseUrl = (env.SMOKE_BASE_URL || process.env.SMOKE_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const email = env.SMOKE_EMAIL || process.env.SMOKE_EMAIL;
const password = env.SMOKE_PASSWORD || process.env.SMOKE_PASSWORD;
const outDir = path.join(root, 'apps', 'web', 'public', 'site');
const sharp = loadSharp();

function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match) out[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

/** The next Sunday: a seeded working day, so the diary is full. */
function nextSunday() {
  const day = new Date();
  day.setDate(day.getDate() + ((7 - day.getDay()) % 7 || 7));
  return day.toISOString().slice(0, 10);
}

const HIDE = 'p[role="status"].bg-amber-200, [data-getting-started], [data-install-hint] { display: none !important; }';

async function signIn(context, locale) {
  const page = await context.newPage();
  await page.goto(`${baseUrl}/${locale}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await Promise.all([page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60_000 }), page.click('form button[type="submit"]')]);
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
  // The banner element, whichever language it speaks.
  if (!(await page.locator('p[role="status"].bg-amber-200').count())) throw new Error('Not the sandbox clinic: refusing to photograph it.');
  return page;
}

async function shoot(page, name, locale) {
  await page.addStyleTag({ content: HIDE });
  await page.waitForTimeout(600);
  const png = await page.screenshot({ type: 'png' });
  fs.mkdirSync(outDir, { recursive: true });
  if (sharp) {
    const file = path.join(outDir, `${name}-${locale}.webp`);
    await sharp(png).webp({ quality: 82 }).toFile(file);
    console.log('wrote', path.relative(root, file), `${Math.round(fs.statSync(file).size / 1024)} KB`);
  } else {
    const file = path.join(outDir, `${name}-${locale}.jpg`);
    fs.writeFileSync(file, await page.screenshot({ type: 'jpeg', quality: 82 }));
    console.log('wrote', path.relative(root, file), '(no sharp: jpeg)');
  }
}

/** The first list row of a seeded person: Hebrew letters in the name, no test-run name. */
async function seededRecord(page, prefix, rowOk = () => true) {
  const links = page.locator(`main tbody a[href*="${prefix}"]:not([href*="/new"])`);
  await links.first().waitFor({ timeout: 10_000 });
  const count = await links.count();
  for (let i = 0; i < count; i++) {
    const link = links.nth(i);
    const name = ((await link.textContent()) ?? '').trim();
    const text = ((await link.locator('xpath=ancestor::tr[1]').textContent()) ?? '').trim();
    if (/[א-ת]/.test(name) && !name.includes('בדיקה') && rowOk(text)) return await link.getAttribute('href');
  }
  return await links.first().getAttribute('href');
}

async function open(page, route) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(800);
}

if (!email || !password) throw new Error('SMOKE_EMAIL and SMOKE_PASSWORD are not set (apps/web/.env.test.local).');
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'msedge', headless: true });
try {
  const sunday = nextSunday();
  for (const locale of ['he', 'en']) {
    const desktop = await browser.newContext({
      locale: locale === 'he' ? 'he-IL' : 'en-GB',
      timezoneId: 'Asia/Jerusalem',
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1.5,
    });
    const page = await signIn(desktop, locale);
    await open(page, `/${locale}/`);
    await shoot(page, 'dashboard', locale);
    await open(page, `/${locale}/calendar?view=week&date=${sunday}`);
    await shoot(page, 'calendar', locale);
    // The first treatment on the list, and the first patient file.
    await open(page, `/${locale}/encounters`);
    // A seeded record, not the test runs' own: a row whose name is Hebrew
    // and not a "בדיקה" patient; the header's "new" link is skipped too.
    // A signed visit, so the record is full rather than a fresh draft.
    await open(page, new URL(await seededRecord(page, '/encounters/', (text) => /חתום|Signed/.test(text)), baseUrl).pathname);
    await shoot(page, 'treatment', locale);
    await open(page, `/${locale}/patients`);
    // The file's treatment history rather than its overview: the overview carries the seed's own note.
    await open(page, new URL(await seededRecord(page, '/patients/'), baseUrl).pathname + '?tab=encounters');
    await shoot(page, 'patient', locale);
    await desktop.close();

    const phone = await browser.newContext({
      locale: locale === 'he' ? 'he-IL' : 'en-GB',
      timezoneId: 'Asia/Jerusalem',
      viewport: { width: 390, height: 780 },
      deviceScaleFactor: 2,
    });
    const small = await signIn(phone, locale);
    await open(small, `/${locale}/`);
    await shoot(small, 'phone-dashboard', locale);
    await open(small, `/${locale}/calendar?view=day&date=${sunday}`);
    await shoot(small, 'phone-calendar', locale);
    await phone.close();
  }
} finally {
  await browser.close();
}
