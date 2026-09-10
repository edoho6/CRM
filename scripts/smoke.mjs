/**
 * Opens every screen of the web app in a real browser and reports what broke.
 *
 * check-a11y.mjs covers the handful of public pages with jsdom; everything
 * behind the login — most of the application — had never been opened by a
 * machine. This does that: it signs in, walks every route in both languages
 * at a desktop and a phone width, and records console errors, uncaught
 * exceptions, failed requests, Next's error overlay, the app's own error
 * boundaries, and pages that rendered nothing. It also drives the flows a
 * static read cannot judge: dialogs opening from menus, tab switches, the
 * filters that rewrite the URL, dark mode, the 3D body.
 *
 * It refuses to run against anything but a sandbox clinic. After signing in
 * it waits for the amber "synthetic data" banner and aborts if that banner
 * is absent, because opening a patient file writes to the access log and a
 * smoke run must never touch a real practice.
 *
 * Credentials come from apps/web/.env.test.local (git-ignored):
 *   SMOKE_EMAIL=…      SMOKE_PASSWORD=…      SMOKE_BASE_URL=http://localhost:3000
 * The browser is the Edge already installed on Windows (`channel: 'msedge'`);
 * set PW_CHANNEL=chromium after `npx playwright install chromium` to use that.
 *
 * Usage:  node scripts/smoke.mjs [--public-only] [--desktop-only] [--he-only]
 * Output: test-results/smoke/<timestamp>/{report.json, summary.md, screenshots/}
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const args = new Set(process.argv.slice(2));
const publicOnly = args.has('--public-only');
const desktopOnly = args.has('--desktop-only');
const heOnly = args.has('--he-only');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = readEnv(path.join(root, 'apps', 'web', '.env.test.local'));
const baseUrl = (env.SMOKE_BASE_URL || process.env.SMOKE_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const email = env.SMOKE_EMAIL || process.env.SMOKE_EMAIL;
const password = env.SMOKE_PASSWORD || process.env.SMOKE_PASSWORD;

const locales = heOnly ? ['he'] : ['he', 'en'];
const widths = desktopOnly ? [{ name: '1280', width: 1280, height: 900 }] : [
  { name: '1280', width: 1280, height: 900 },
  { name: '390', width: 390, height: 844 },
];

/** Text that only the error surfaces render. */
const ERROR_TEXTS = ['אירעה שגיאה', 'משהו השתבש', 'Something went wrong', 'Page not found', 'הדף לא נמצא'];
/** The sandbox banner: the run's only permission to proceed. */
const SYNTHETIC_TEXT = 'סביבת פיתוח';
/** Console noise that is not a defect. */
const IGNORED_CONSOLE = [
  /Download the React DevTools/,
  /\[Fast Refresh\]/,
  /Warning: Extra attributes from the server/, // theme attribute set by the init script
  /GroupMarkerNotSet|SwiftShader|GPU stall|WebGL/i, // headless graphics, expected
];

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join(root, 'test-results', 'smoke', stamp);
const shotDir = path.join(outDir, 'screenshots');
fs.mkdirSync(shotDir, { recursive: true });

const report = [];

function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match) out[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

async function waitForServer() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/he/login`, { redirect: 'manual' });
      if (response.status < 500) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error(`No server at ${baseUrl}. Start it with: pnpm dev:web`);
}

/** Wires the collectors onto a page and returns the bag they fill. */
function observe(page) {
  const bag = { consoleErrors: [], consoleWarnings: [], pageErrors: [], failedRequests: [] };
  page.on('console', (message) => {
    const text = message.text();
    if (IGNORED_CONSOLE.some((pattern) => pattern.test(text))) return;
    if (message.type() === 'error') {
      const where = message.location()?.url ? ` @ ${message.location().url}` : '';
      bag.consoleErrors.push(`${text.slice(0, 400)}${where}`);
    }
    else if (message.type() === 'warning') bag.consoleWarnings.push(text.slice(0, 300));
  });
  page.on('pageerror', (error) => bag.pageErrors.push(String(error?.message ?? error).slice(0, 500)));
  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();
    if (status >= 400 && !url.includes('/he/platform') && !url.includes('/en/platform')) {
      bag.failedRequests.push({ url: url.slice(0, 200), status, method: response.request().method() });
    }
  });
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText ?? '';
    if (/ERR_ABORTED/.test(failure)) return; // navigations cancel in-flight fetches; not a defect
    bag.failedRequests.push({ url: request.url().slice(0, 200), status: 0, method: request.method(), failure });
  });
  return bag;
}

async function inspect(page) {
  return page.evaluate((errorTexts) => {
    const body = document.body?.innerText ?? '';
    // The dev tools badge lives in the same portal as the error overlay; only
    // an open dialog that talks about an error counts.
    const portal = document.querySelector('nextjs-portal')?.shadowRoot;
    const dialog = portal?.querySelector('[data-nextjs-dialog]');
    const overlay = Boolean(dialog && /error|failed|שגיאה/i.test(dialog.textContent ?? ''));
    const main = document.querySelector('main#main-content');
    const emptyMain = main ? main.children.length === 0 && main.innerText.trim() === '' : false;
    const errorText = errorTexts.find((text) => body.includes(text)) ?? null;
    const devError = document.querySelector('main pre[dir="ltr"]')?.textContent?.slice(0, 500) ?? null;
    return {
      overlay,
      emptyMain,
      errorText,
      devError,
      title: document.title,
      h1: document.querySelector('h1')?.textContent?.trim() ?? null,
      synthetic: body.includes('סביבת פיתוח'),
    };
  }, ERROR_TEXTS);
}

async function visit(context, { route, locale, width, label = route, expect404 = false, before, after }) {
  const page = await context.newPage();
  await page.setViewportSize({ width: width.width, height: width.height });
  const bag = observe(page);
  const url = `${baseUrl}/${locale}${route}`;
  const started = Date.now();
  let httpStatus = null;
  let finalUrl = url;
  let inspection = null;
  let flow = null;
  try {
    if (before) await before(page);
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    httpStatus = response?.status() ?? null;
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(400);
    if (after) flow = await after(page);
    finalUrl = page.url();
    inspection = await inspect(page);
    const file = `${locale}__${label.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home'}__${width.name}.png`;
    await page.screenshot({ path: path.join(shotDir, file), fullPage: true });
    inspection.screenshot = path.join('screenshots', file);
  } catch (error) {
    bag.pageErrors.push(`harness: ${String(error?.message ?? error).slice(0, 300)}`);
  }
  await page.close();

  const entry = {
    route,
    label,
    locale,
    width: width.name,
    url,
    finalUrl,
    httpStatus,
    durationMs: Date.now() - started,
    ...bag,
    ...(inspection ?? {}),
    flow,
  };
  const notFound = inspection?.errorText === 'Page not found' || inspection?.errorText === 'הדף לא נמצא';
  entry.failures = [
    ...bag.pageErrors.map((message) => `page error: ${message}`),
    ...bag.consoleErrors.map((message) => `console: ${message}`),
    ...bag.failedRequests.map((request) => `request ${request.status}: ${request.url}`),
    inspection?.overlay ? 'next.js error overlay' : null,
    inspection?.emptyMain ? 'empty <main>' : null,
    inspection?.errorText && !(expect404 && notFound) ? `error text: ${inspection.errorText}` : null,
    inspection?.devError ? `boundary: ${inspection.devError}` : null,
    flow && flow.ok === false ? `flow: ${flow.detail}` : null,
  ].filter(Boolean);
  report.push(entry);
  const mark = entry.failures.length ? 'FAIL' : ' ok ';
  console.log(`${mark}  ${locale} ${width.name.padStart(4)}  ${label}${entry.failures.length ? `\n        ${entry.failures.join('\n        ')}` : ''}`);
  return entry;
}

/** First hrefs matching a pattern on a list page, for the dynamic routes. */
async function collectIds(context, route, pattern, limit = 2) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${baseUrl}/he${route}`, { waitUntil: 'networkidle', timeout: 45_000 }).catch(() => {});
  const ids = await page.evaluate(
    ({ pattern, limit }) => {
      const regex = new RegExp(pattern);
      const found = [];
      for (const anchor of document.querySelectorAll('main a[href]')) {
        const match = anchor.getAttribute('href')?.match(regex);
        if (match && !found.includes(match[1])) found.push(match[1]);
        if (found.length >= limit) break;
      }
      return found;
    },
    { pattern, limit },
  );
  await page.close();
  return ids;
}

async function login(browser) {
  const context = await browser.newContext({ locale: 'he-IL', timezoneId: 'Asia/Jerusalem' });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/he/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 }),
    page.click('form button[type="submit"]'),
  ]);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  const banner = await page.locator(`text=${SYNTHETIC_TEXT}`).count();
  if (banner === 0) {
    await context.close();
    throw new Error(
      'Signed in, but this clinic is not marked synthetic (no sandbox banner). Refusing to continue: a smoke run must never open a real practice.',
    );
  }
  await page.close();
  return context;
}

/* ---- the flows a static read cannot judge ------------------------------- */

const flows = {
  async quickCreate(page) {
    const trigger = page.locator('button[aria-label="יצירה מהירה"], button[aria-label="Quick create"]').first();
    await trigger.click();
    const items = await page.locator('[role="menuitem"]').count();
    await page.keyboard.press('Escape');
    return { ok: items >= 5, detail: `menu items: ${items}` };
  },
  async globalSearch(page) {
    await page.keyboard.press('Control+k');
    const input = page.locator('input[type="search"]').first();
    await input.waitFor({ timeout: 3_000 });
    await input.fill('a');
    await page.waitForTimeout(700);
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    await page.keyboard.press('Escape');
    return { ok: focused === 'INPUT', detail: `focus on ${focused}` };
  },
  async newAppointmentDialog(page) {
    const dialog = page.locator('[role="dialog"]');
    await dialog.first().waitFor({ timeout: 5_000 });
    const patientField = await dialog.locator('#patient_id').count();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const clickable = await page.evaluate(() => getComputedStyle(document.body).pointerEvents !== 'none');
    return { ok: patientField === 1 && clickable, detail: `patient field ${patientField}, body clickable ${clickable}` };
  },
  async protocolMenuThenDialog(page) {
    // "…" → save as protocol → close → the page must still be clickable.
    const more = page.locator('button[aria-label="עוד פעולות"], button[aria-label="More actions"]').first();
    if ((await more.count()) === 0) return { ok: true, detail: 'signed record, no menu' };
    await more.click();
    await page.locator('[role="menuitem"]').first().click();
    const dialog = page.locator('[role="dialog"]').first();
    await dialog.waitFor({ timeout: 5_000 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const clickable = await page.evaluate(() => getComputedStyle(document.body).pointerEvents !== 'none');
    const dialogsLeft = await page.locator('[role="dialog"]').count();
    return { ok: clickable && dialogsLeft === 0, detail: `clickable ${clickable}, dialogs left ${dialogsLeft}` };
  },
  async blockDayThenEscape(page) {
    const trigger = page.locator('button[aria-label*="חסימ"], button[aria-label*="Block"], button[aria-label*="Close day"]').first();
    if ((await trigger.count()) === 0) return { ok: true, detail: 'no block-day trigger visible' };
    await trigger.click();
    await page.locator('[role="dialog"]').first().waitFor({ timeout: 5_000 }).catch(() => {});
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const clickable = await page.evaluate(() => getComputedStyle(document.body).pointerEvents !== 'none');
    return { ok: clickable, detail: `body clickable ${clickable}` };
  },
  async statusTileKeepsFilter(page) {
    const tile = page.locator('main button[aria-pressed], main a[aria-current]').nth(1);
    if ((await tile.count()) === 0) return { ok: true, detail: 'no tiles' };
    await tile.click();
    await page.waitForTimeout(900);
    const url = page.url();
    return { ok: /[?&](status|inactive|noUpcoming)=/.test(url), detail: url };
  },
  async patientTab(page) {
    const selected = await page.locator('[role="tab"][aria-selected="true"]').getAttribute('id');
    const ok = /encounters/.test(selected ?? '') || (await page.locator('[role="tab"][aria-selected="true"]').textContent())?.includes('טיפול');
    return { ok: Boolean(ok), detail: `selected tab: ${selected}` };
  },
  async bodyToggle(page) {
    const group = page.locator('[role="group"][aria-label="תצוגת גוף"], [role="group"][aria-label="Body view"]').first();
    if ((await group.count()) === 0) return { ok: true, detail: 'no body panel (signed?)' };
    await group.locator('button').nth(1).click();
    await page.waitForTimeout(300);
    const svg = await page.locator('main figure svg').count();
    await group.locator('button').nth(0).click();
    await page.waitForTimeout(1500);
    const canvas = await page.locator('main canvas').count();
    return { ok: svg >= 2, detail: `2D svgs ${svg}, 3D canvas ${canvas}` };
  },
  async darkModeApplied(page) {
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    return { ok: theme === 'dark', detail: `data-theme=${theme}` };
  },
};

/* ---- main ---------------------------------------------------------------- */

const STATIC_ROUTES = [
  '/', '/patients', '/patients/new', '/calendar', '/calendar?view=day', '/calendar?view=month',
  '/calendar?view=range', '/tasks', '/messages', '/encounters', '/encounters/new', '/forms',
  '/forms/new', '/reference/herbs', '/reference/formulas', '/reference/points', '/reference/compare',
  '/inventory', '/inventory?tab=low', '/inventory/batches', '/inventory/batches/receive',
  '/inventory/suppliers', '/billing', '/billing/new', '/billing/settings', '/reports', '/assistant',
  '/settings', '/settings/access', '/settings/booking', '/settings/consent', '/settings/tags',
  '/account', '/account/protocols', '/account/schedule', '/accessibility',
];
const PUBLIC_ROUTES = ['/login', '/signup', '/setup'];

async function main() {
  await waitForServer();
  const browser = await chromium.launch({
    channel: process.env.PW_CHANNEL ?? 'msedge',
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });

  try {
    // Public pages: a fresh, signed-out context.
    const anonymous = await browser.newContext({ locale: 'he-IL' });
    for (const locale of locales) for (const width of widths) for (const route of PUBLIC_ROUTES) {
      await visit(anonymous, { route, locale, width });
    }
    await anonymous.close();

    if (publicOnly) return;
    if (!email || !password) {
      throw new Error('SMOKE_EMAIL and SMOKE_PASSWORD are not set (apps/web/.env.test.local).');
    }

    const context = await login(browser);

    // Dynamic ids, read off the list pages while signed in.
    const [patientIds, encounterIds, invoiceIds, formIds, herbIds, formulaIds, pointIds] = await Promise.all([
      collectIds(context, '/patients', '/patients/([0-9a-f-]{36})$'),
      collectIds(context, '/encounters', '/encounters/([0-9a-f-]{36})$'),
      collectIds(context, '/billing', '/billing/([0-9a-f-]{36})$'),
      collectIds(context, '/forms', '/forms/([0-9a-f-]{36})$'),
      collectIds(context, '/reference/herbs', '/reference/herbs/([0-9a-f-]{36})$'),
      collectIds(context, '/reference/formulas', '/reference/formulas/([0-9a-f-]{36})$'),
      collectIds(context, '/reference/points', '/reference/points/([0-9a-f-]{36})$'),
    ]);
    const skipped = [];
    const dynamic = [];
    const add = (name, ids, make) => (ids.length ? dynamic.push(...ids.slice(0, 1).map(make)) : skipped.push(name));
    add('patients/[id]', patientIds, (id) => `/patients/${id}`);
    add('patients/[id]/edit', patientIds, (id) => `/patients/${id}/edit`);
    add('encounters/[id]', encounterIds, (id) => `/encounters/${id}`);
    add('billing/[id]', invoiceIds, (id) => `/billing/${id}`);
    add('forms/[id]', formIds, (id) => `/forms/${id}`);
    add('reference/herbs/[id]', herbIds, (id) => `/reference/herbs/${id}`);
    add('reference/herbs/[id]/edit', herbIds, (id) => `/reference/herbs/${id}/edit`);
    add('reference/formulas/[id]', formulaIds, (id) => `/reference/formulas/${id}`);
    add('reference/points/[id]', pointIds, (id) => `/reference/points/${id}`);
    if (herbIds.length >= 2) dynamic.push(`/reference/compare?kind=herb&ids=${herbIds.join(',')}`);

    for (const locale of locales) for (const width of widths) {
      for (const route of [...STATIC_ROUTES, ...dynamic]) await visit(context, { route, locale, width });
      await visit(context, { route: '/platform', locale, width, expect404: true });
    }

    // Flows, desktop, Hebrew: what a static read cannot judge.
    const desktop = widths[0];
    const phone = widths[1];
    await visit(context, { route: '/', locale: 'he', width: desktop, label: 'flow quick-create', after: flows.quickCreate });
    await visit(context, { route: '/', locale: 'he', width: desktop, label: 'flow global-search', after: flows.globalSearch });
    await visit(context, { route: '/calendar?new=1', locale: 'he', width: desktop, label: 'flow new-appointment', after: flows.newAppointmentDialog });
    await visit(context, { route: '/calendar?view=week', locale: 'he', width: desktop, label: 'flow block-day-escape', after: flows.blockDayThenEscape });
    await visit(context, { route: '/patients', locale: 'he', width: desktop, label: 'flow status-tile-filter', after: flows.statusTileKeepsFilter });
    await visit(context, { route: '/reference/herbs?page=2', locale: 'he', width: desktop, label: 'catalogue page 2' });
    if (patientIds[0]) {
      await visit(context, { route: `/patients/${patientIds[0]}?tab=encounters`, locale: 'he', width: desktop, label: 'flow patient-tab', after: flows.patientTab });
      if (phone) {
        await visit(context, {
          route: `/calendar?patient=${patientIds[0]}&new=1`, locale: 'he', width: phone, label: 'flow phone-new-keeps-patient',
          after: async (page) => ({ ok: page.url().includes('patient='), detail: page.url() }),
        });
      }
    }
    if (encounterIds[0]) {
      await visit(context, { route: `/encounters/${encounterIds[0]}`, locale: 'he', width: desktop, label: 'flow protocol-menu-dialog', after: flows.protocolMenuThenDialog });
      await visit(context, { route: `/encounters/${encounterIds[0]}`, locale: 'he', width: desktop, label: 'flow body-2d-3d', after: flows.bodyToggle });
    }
    await visit(context, {
      route: '/', locale: 'he', width: desktop, label: 'dark mode dashboard',
      before: (page) => page.addInitScript(() => localStorage.setItem('herbalist-theme', 'dark')),
      after: flows.darkModeApplied,
    });
    if (patientIds[0]) {
      await visit(context, {
        route: `/patients/${patientIds[0]}`, locale: 'he', width: desktop, label: 'dark mode patient',
        before: (page) => page.addInitScript(() => localStorage.setItem('herbalist-theme', 'dark')),
        after: flows.darkModeApplied,
      });
    }

    if (skipped.length) console.log(`\nskipped (no rows to open): ${skipped.join(', ')}`);
    await context.close();
  } finally {
    await browser.close();
    writeReport();
  }
}

function writeReport() {
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  const failed = report.filter((entry) => entry.failures.length);
  const lines = [
    `# Smoke run ${stamp}`,
    '',
    `${report.length} visits, ${failed.length} with problems.`,
    '',
    ...(failed.length ? ['## Problems', ''] : []),
    ...failed.flatMap((entry) => [
      `### ${entry.locale} ${entry.width} ${entry.label}`,
      `<${entry.finalUrl}>`,
      ...entry.failures.map((failure) => `- ${failure}`),
      entry.screenshot ? `- screenshot: ${entry.screenshot}` : '',
      '',
    ]),
    '## All visits',
    '',
    ...report.map((entry) => `- ${entry.failures.length ? '❌' : '✅'} ${entry.locale} ${entry.width} ${entry.label} (${entry.durationMs} ms)`),
  ];
  fs.writeFileSync(path.join(outDir, 'summary.md'), lines.join('\n'));
  console.log(`\n${report.length} visits, ${failed.length} with problems → ${path.relative(root, outDir)}`);
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
