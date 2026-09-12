// The store listings' screenshots, taken from the sandbox clinic (fictional
// patients only) with the same headless Edge the smoke runs in, as the
// store apps show the screens: the shell's user agent, a phone's viewport,
// no install hint, no sandbox banner in the picture.
//
//   SMOKE_BASE_URL=http://localhost:3002 SMOKE_PORTAL_URL=http://localhost:3003 node scripts/render-store-shots.mjs
//
// Refuses to run without the sandbox banner. The staff app is photographed
// with the smoke account; the portal only when SMOKE_PORTAL_EMAIL and
// SMOKE_PORTAL_PASSWORD are set (a patient of the sandbox clinic with a
// password — the reviewers' door, which the database opens only there).
//
// Output, where fastlane and the consoles expect it:
//   apps/mobile-<app>/fastlane/screenshots/<he|en-US>/<device>-<n>-<screen>.jpg     (App Store)
//   apps/mobile-<app>/fastlane/metadata/android/<iw-IL|en-US>/images/phoneScreenshots/<n>-<screen>.jpg
//   apps/mobile-<app>/fastlane/metadata/android/<locale>/images/featureGraphic.jpg  (1024×500)
//   apps/mobile-<app>/fastlane/metadata/android/<locale>/images/icon.png            (512×512)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = readEnv(path.join(root, 'apps', 'web', '.env.test.local'));
const baseUrl = (env.SMOKE_BASE_URL || process.env.SMOKE_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const portalUrl = (env.SMOKE_PORTAL_URL || process.env.SMOKE_PORTAL_URL || 'http://localhost:3001').replace(/\/$/, '');
const email = env.SMOKE_EMAIL || process.env.SMOKE_EMAIL;
const password = env.SMOKE_PASSWORD || process.env.SMOKE_PASSWORD;
const portalEmail = env.SMOKE_PORTAL_EMAIL || process.env.SMOKE_PORTAL_EMAIL;
const portalPassword = env.SMOKE_PORTAL_PASSWORD || process.env.SMOKE_PORTAL_PASSWORD;

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

/** What each store wants, as the phone the shell would be running on. */
const DEVICES = [
  // App Store: the 6.7" iPhone (1290×2796) and the 6.9" one (1320×2868).
  { store: 'ios', name: 'iphone67', viewport: { width: 430, height: 932 }, scale: 3, ua: 'ios' },
  { store: 'ios', name: 'iphone69', viewport: { width: 440, height: 956 }, scale: 3, ua: 'ios' },
  // Google Play: 1080×1920 keeps to the 16:9 the console is happiest with.
  { store: 'android', name: 'phone', viewport: { width: 405, height: 720 }, scale: 8 / 3, ua: 'android' },
];

const LOCALES = [
  { locale: 'he', browser: 'he-IL', ios: 'he', android: 'iw-IL' },
  { locale: 'en', browser: 'en-GB', ios: 'en-US', android: 'en-US' },
];

const shellUserAgent = (app, platform) =>
  platform === 'ios'
    ? `Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 HerbalistShell/1.0.0 (${app}; ios)`
    : `Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36 HerbalistShell/1.0.0 (${app}; android)`;

function outputPaths(app, device, localeDef, index, screen) {
  const n = String(index + 1).padStart(2, '0');
  if (device.store === 'ios') {
    return path.join(root, 'apps', `mobile-${app}`, 'fastlane', 'screenshots', localeDef.ios, `${device.name}-${n}-${screen}.jpg`);
  }
  return path.join(root, 'apps', `mobile-${app}`, 'fastlane', 'metadata', 'android', localeDef.android, 'images', 'phoneScreenshots', `${n}-${screen}.jpg`);
}

async function shoot(page, file) {
  await page.addStyleTag({ content: HIDE });
  await page.waitForTimeout(700);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, type: 'jpeg', quality: 92 });
  console.log('wrote', path.relative(root, file));
}

async function open(page, url) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(800);
}

/** The first list row of a seeded person: Hebrew letters in the name, not a test run's. */
async function seededRecord(page, prefix, rowOk = () => true) {
  const links = page.locator(`main tbody a[href*="${prefix}"]:not([href*="/new"]), main a[href*="${prefix}"]:not([href*="/new"])`);
  await links.first().waitFor({ timeout: 10_000 });
  const count = await links.count();
  for (let i = 0; i < count; i++) {
    const link = links.nth(i);
    const name = ((await link.textContent()) ?? '').trim();
    const text = ((await link.locator('xpath=ancestor::tr[1]').textContent().catch(() => '')) ?? '').trim();
    // A seeded person, a finished record: not a test run's patient, not a draft.
    if (/[א-ת]/.test(name) && !name.includes('בדיקה') && !/טיוטה|Draft/.test(text) && rowOk(text)) return await link.getAttribute('href');
  }
  return await links.first().getAttribute('href');
}

async function signInStaff(context, locale) {
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem('herbalist-install-hint-hidden', '1'));
  await page.goto(`${baseUrl}/${locale}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await Promise.all([page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60_000 }), page.click('form button[type="submit"]')]);
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
  if (!(await page.locator('p[role="status"].bg-amber-200').count())) throw new Error('Not the sandbox clinic: refusing to photograph it.');
  return page;
}

/** Through the reviewers' door: a password, honoured only in a synthetic clinic. */
async function signInPortal(context, locale) {
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem('herbalist-portal-install-hint-hidden', '1'));
  await page.goto(`${portalUrl}/${locale}/login`, { waitUntil: 'networkidle' });
  await page.locator('summary').click();
  await page.fill('#password-email', portalEmail);
  await page.fill('#password', portalPassword);
  await Promise.all([page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60_000 }), page.locator('details form button[type="submit"]').click()]);
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
  return page;
}

/** The staff app's screens, in the order the listing tells its story. */
async function staffScreens(page, locale, sunday) {
  return [
    { screen: 'dashboard', go: () => open(page, `${baseUrl}/${locale}/`) },
    { screen: 'calendar', go: () => open(page, `${baseUrl}/${locale}/calendar?view=day&date=${sunday}`) },
    {
      screen: 'patient',
      go: async () => {
        await open(page, `${baseUrl}/${locale}/patients`);
        await open(page, `${baseUrl}${new URL(await seededRecord(page, '/patients/'), baseUrl).pathname}?tab=encounters`);
      },
    },
    {
      screen: 'treatment',
      go: async () => {
        await open(page, `${baseUrl}/${locale}/encounters`);
        await open(page, `${baseUrl}${new URL(await seededRecord(page, '/encounters/', (text) => /חתום|Signed/.test(text)), baseUrl).pathname}`);
      },
    },
    { screen: 'tasks', go: () => open(page, `${baseUrl}/${locale}/tasks`) },
  ];
}

function portalScreens(page, locale) {
  return [
    { screen: 'home', go: () => open(page, `${portalUrl}/${locale}/`) },
    { screen: 'forms', go: () => open(page, `${portalUrl}/${locale}/forms`) },
    { screen: 'consent', go: () => open(page, `${portalUrl}/${locale}/consent`) },
  ];
}

/** The Play feature graphic (1024×500) and the 512 icon, drawn from the leaf. */
async function renderGraphics(browser, app, localeDef, names) {
  const source = fs.readFileSync(path.join(root, app === 'clinic' ? 'apps/web/app/icon.svg' : 'apps/portal/app/icon.svg'), 'utf8');
  const leaf = source.replace(/<rect[^>]*\/>/, '');
  const leafUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(leaf)}`;
  const dir = path.join(root, 'apps', `mobile-${app}`, 'fastlane', 'metadata', 'android', localeDef.android, 'images');
  fs.mkdirSync(dir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  const rtl = localeDef.locale === 'he';
  await page.setContent(`<style>
    html,body{margin:0;width:1024px;height:500px;background:#16a25c;font-family:'Segoe UI',system-ui,'Noto Sans Hebrew',Arial,sans-serif;color:#fff}
    .wrap{display:flex;align-items:center;justify-content:center;gap:48px;height:100%;direction:${rtl ? 'rtl' : 'ltr'}}
    img{width:220px;height:220px}
    h1{font-size:72px;margin:0;font-weight:700;letter-spacing:-0.5px}
    p{font-size:30px;margin:12px 0 0;opacity:.92}
  </style><div class="wrap"><img src="${leafUrl}"><div><h1>${names.title}</h1><p>${names.tagline}</p></div></div>`);
  await page.locator('img').waitFor();
  await page.screenshot({ path: path.join(dir, 'featureGraphic.jpg'), type: 'jpeg', quality: 92 });
  console.log('wrote', path.relative(root, path.join(dir, 'featureGraphic.jpg')));
  await page.setViewportSize({ width: 512, height: 512 });
  const iconUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
  await page.setContent(`<style>html,body{margin:0;background:transparent}img{display:block;width:512px;height:512px}</style><img src="${iconUrl}">`);
  await page.locator('img').waitFor();
  await page.screenshot({ path: path.join(dir, 'icon.png'), omitBackground: true, clip: { x: 0, y: 0, width: 512, height: 512 } });
  console.log('wrote', path.relative(root, path.join(dir, 'icon.png')));
  await page.close();
}

const NAMES = {
  clinic: { he: { title: 'הרבליסט', tagline: 'ניהול קליניקה לרפואה סינית' }, en: { title: 'Herbalist', tagline: 'Chinese medicine clinic management' } },
  portal: { he: { title: 'הרבליסט', tagline: 'אזור המטופל' }, en: { title: 'Herbalist', tagline: 'Patient portal' } },
};

if (!email || !password) throw new Error('SMOKE_EMAIL and SMOKE_PASSWORD are not set (apps/web/.env.test.local).');
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'msedge', headless: true });
try {
  const sunday = nextSunday();
  for (const localeDef of LOCALES) {
    await renderGraphics(browser, 'clinic', localeDef, NAMES.clinic[localeDef.locale]);
    await renderGraphics(browser, 'portal', localeDef, NAMES.portal[localeDef.locale]);
    for (const device of DEVICES) {
      const context = await browser.newContext({
        locale: localeDef.browser,
        timezoneId: 'Asia/Jerusalem',
        viewport: device.viewport,
        deviceScaleFactor: device.scale,
        userAgent: shellUserAgent('clinic', device.ua),
      });
      const page = await signInStaff(context, localeDef.locale);
      const screens = await staffScreens(page, localeDef.locale, sunday);
      for (const [index, { screen, go }] of screens.entries()) {
        await go();
        await shoot(page, outputPaths('clinic', device, localeDef, index, screen));
      }
      await context.close();

      if (portalEmail && portalPassword) {
        const portal = await browser.newContext({
          locale: localeDef.browser,
          timezoneId: 'Asia/Jerusalem',
          viewport: device.viewport,
          deviceScaleFactor: device.scale,
          userAgent: shellUserAgent('portal', device.ua),
        });
        const page = await signInPortal(portal, localeDef.locale);
        for (const [index, { screen, go }] of portalScreens(page, localeDef.locale).entries()) {
          await go();
          await shoot(page, outputPaths('portal', device, localeDef, index, screen));
        }
        await portal.close();
      }
    }
  }
  if (!portalEmail || !portalPassword) console.log('portal: skipped (set SMOKE_PORTAL_EMAIL and SMOKE_PORTAL_PASSWORD for a sandbox patient with a password)');
} finally {
  await browser.close();
}
