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
 * Usage:  node scripts/smoke.mjs [--public-only] [--desktop-only] [--he-only] [--write]
 * --write adds flows that save, then remove, a patient edit, a task and an
 * appointment — the paths a screenshot cannot judge. Sandbox clinic only.
 * Output: test-results/smoke/<timestamp>/{report.json, summary.md, screenshots/}
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';

const args = new Set(process.argv.slice(2));
const publicOnly = args.has('--public-only');
const desktopOnly = args.has('--desktop-only');
const heOnly = args.has('--he-only');
/** --write also runs the flows that create and delete rows (sandbox clinic only). */
const writeFlows = args.has('--write');
/** --only=/reports,/patients limits the walk to routes containing one of these. */
const only = [...args].find((arg) => arg.startsWith('--only='))?.slice(7).split(',').filter(Boolean) ?? null;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = readEnv(path.join(root, 'apps', 'web', '.env.test.local'));
const baseUrl = (env.SMOKE_BASE_URL || process.env.SMOKE_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const portalUrl = (env.SMOKE_PORTAL_URL || process.env.SMOKE_PORTAL_URL || 'http://localhost:3001').replace(/\/$/, '');
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

/**
 * axe, in a real browser.
 *
 * check-a11y.mjs runs axe under jsdom, which has no layout — so it can only
 * reach the public pages and has to switch colour-contrast off. Here every
 * screen behind the login is audited with real geometry and real colours.
 */
const axeSource = fs.readFileSync(createRequire(import.meta.url).resolve('axe-core'), 'utf8');
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
/** --dark opens every screen in dark mode — the two dark visits at the end are not a dark-mode audit. */
const darkAll = args.has('--dark');
/** --no-axe skips the audit, for a quick run. */
const skipAxe = args.has('--no-axe');

async function auditAccessibility(page) {
  await page.evaluate(axeSource);
  return page.evaluate(
    async ({ tags }) =>
      (
        await window.axe.run(document, {
          runOnly: { type: 'tag', values: tags },
          resultTypes: ['violations'],
        })
      ).violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        count: violation.nodes.length,
        // One example is enough to find it; the full list is noise in a report.
        example: violation.nodes[0]?.target?.join(' ')?.slice(0, 160) ?? '',
      })),
    { tags: AXE_TAGS },
  );
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join(root, 'test-results', 'smoke', stamp + (darkAll ? '-dark' : ''));
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
      bag.consoleErrors.push(`${text.slice(0, 2500)}${where}`);
    }
    else if (message.type() === 'warning') bag.consoleWarnings.push(text.slice(0, 300));
  });
  page.on('pageerror', (error) => bag.pageErrors.push(String(error?.message ?? error).slice(0, 4000)));
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

async function visit(context, options) {
  const entry = await visitOnce(context, options);
  const signedInRoute = context === current.context && !PUBLIC_ROUTES.includes(options.route);
  if (entry && signedInRoute && /\/login(\?|$)/.test(entry.finalUrl ?? '') && !options.retried) {
    console.log('        session gone — signing in again');
    report.pop();
    current.context = await login(current.browser);
    return visit(current.context, { ...options, retried: true });
  }
  return entry;
}

/** The signed-in context in use; `visit` swaps it when the session is lost. */
const current = { browser: null, context: null };

/**
 * A plain HTTP read with a few assertions, reported like a visit: for the
 * files a crawler reads and the tags it looks for, which no page shows.
 */
async function checkText(label, url, assert) {
  if (only && !only.some((needle) => label.includes(needle) || url.includes(needle))) return;
  const started = Date.now();
  let failures;
  try {
    const response = await fetch(url, { redirect: 'manual' });
    const text = await response.text();
    failures = response.ok ? assert(text).filter(Boolean) : [`http ${response.status}`];
  } catch (error) {
    failures = [`request failed: ${error.message}`];
  }
  report.push({ route: url, label, locale: '-', width: '-', finalUrl: url, durationMs: Date.now() - started, failures, screenshot: null });
  console.log(`${failures.length ? 'FAIL' : ' ok '}  -    -  ${label}${failures.length ? `\n        ${failures.join('\n        ')}` : ''}`);
}

async function visitOnce(context, { route, locale, width, label = route, expect404 = false, before, after, origin = baseUrl }) {
  if (only && !only.some((needle) => route.includes(needle) || label.includes(needle))) return null;
  const page = await context.newPage();
  await page.setViewportSize({ width: width.width, height: width.height });
  const bag = observe(page);
  const url = `${origin}/${locale}${route}`;
  const started = Date.now();
  let httpStatus = null;
  let finalUrl = url;
  let inspection = null;
  let flow = null;
  try {
    if (darkAll) await page.addInitScript(() => localStorage.setItem('herbalist-theme', 'dark'));
    if (before) await before(page);
    // The dev server compiles a route the first time it is asked for, and
    // under load that can outlast the timeout. One retry tells a slow compile
    // apart from a page that genuinely never answers.
    let response = await page
      .goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 })
      .catch(() => null);
    if (!response) {
      response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    }
    httpStatus = response?.status() ?? null;
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    // Client-side widgets fetch after hydration; give them a moment so the
    // screenshot shows data rather than a spinner.
    await page.waitForTimeout(900);
    try {
      if (after) {
        flow = await after(page);
        await page
          .evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => null))))
          .catch(() => null);
      }
    } catch (error) {
      bag.pageErrors.push(`harness: ${String(error?.message ?? error).slice(0, 300)}`);
    }
    finalUrl = page.url();
    inspection = await inspect(page);
    if (!skipAxe) inspection.axe = await auditAccessibility(page).catch((error) => [{ id: 'axe-failed', impact: 'serious', help: String(error?.message ?? error).slice(0, 120), count: 1, example: '' }]);
    const file = `${locale}__${label.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home'}__${width.name}.png`;
    // `caret: 'initial'`: the default hides the caret by writing a style onto the
    // focused input, which React then reports as a hydration mismatch.
    await page.screenshot({ path: path.join(shotDir, file), fullPage: true, caret: 'initial' });
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
    ...(inspection?.axe ?? [])
      .filter((violation) => violation.impact === 'critical' || violation.impact === 'serious')
      .map((violation) => `a11y ${violation.impact}: ${violation.id} × ${violation.count} — ${violation.help} (${violation.example})`),
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
  // A list page may navigate once more right after load (remembered filters
  // are put back into the URL), which destroys the first evaluation context.
  await page.waitForTimeout(600);
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
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

/** What one write flow learns for a later one (the booking handle). */
const sandbox = { bookingSlug: null };

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
  // On a phone a dialog is a sheet; pulling its handle down closes it.
  async drawerSwipe(page) {
    const dialog = page.locator('[role="dialog"]').first();
    await dialog.waitFor({ timeout: 5_000 });
    const handle = page.locator('[data-drawer-handle]').first();
    const box = await handle.boundingBox();
    if (!box) return { ok: false, detail: 'no drawer handle on the sheet' };
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 40, { steps: 4 });
    await page.mouse.move(x, y + 240, { steps: 8 });
    await page.mouse.up();
    const gone = await dialog.waitFor({ state: 'detached', timeout: 3_000 }).then(() => true).catch(() => false);
    return { ok: gone, detail: gone ? 'pulled the sheet closed' : 'sheet still open after the pull' };
  },
  async newAppointmentDialog(page) {
    const dialog = page.locator('[role="dialog"]');
    await dialog.first().waitFor({ timeout: 5_000 });
    const patientField = await dialog.locator('#patient_id').count();
    await page.keyboard.press('Escape');
    // Client-side widgets fetch after hydration; give them a moment so the
    // screenshot shows data rather than a spinner.
    await page.waitForTimeout(900);
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
    // An Escape in the same frame the dialog mounts lands before it listens;
    // no hand is that fast.
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached', timeout: 3_000 }).catch(() => {});
    await page.waitForTimeout(300);
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
    // The "no upcoming appointment" tile by its label: the display-mode
    // switch also carries aria-pressed, and picking by position hit that.
    const tile = page
      .locator('main button[aria-pressed]', { hasText: /ללא תור עתידי|No upcoming/ })
      .first();
    if ((await tile.count()) === 0) return { ok: true, detail: 'no tiles' };
    // In dev the first visit can still be hydrating after network idle, so a
    // click may land before React listens; the filter is a URL change, and
    // a second click after a short wait is the retry.
    const filtered = /[?&](status|inactive|noUpcoming)=/;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await tile.click();
      await page.waitForURL(filtered, { timeout: 8000 }).catch(() => {});
      if (filtered.test(page.url())) break;
    }
    const url = page.url();
    return { ok: filtered.test(url), detail: url };
  },
  async filtersRemembered(page) {
    // Search once, leave, come back bare: the list should reopen filtered.
    const input = page.locator('main input[type="search"]').first();
    await input.fill('אב');
    await page.waitForURL(/[?&]q=/, { timeout: 8000 }).catch(() => {});
    if (!/[?&]q=/.test(page.url())) return { ok: false, detail: 'search never reached the URL: ' + page.url() };
    await page.goto(new URL('/he', page.url()).href, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.goto(new URL('/he/patients', page.url()).href, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.waitForURL(/[?&]q=/, { timeout: 8000 }).catch(() => {});
    const remembered = /[?&]q=/.test(page.url());
    // Clearing must be remembered too, or the term springs back forever.
    await page.locator('main input[type="search"]').first().fill('');
    await page.waitForURL((url) => !/[?&]q=/.test(url.href), { timeout: 8000 }).catch(() => {});
    await page.goto(new URL('/he', page.url()).href, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.goto(new URL('/he/patients', page.url()).href, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(900);
    const cleared = !/[?&]q=/.test(page.url());
    return { ok: remembered && cleared, detail: `remembered ${remembered}, cleared ${cleared}, at ${page.url()}` };
  },
  async phoneDrawer(page) {
    // On a phone the dialog is a drawer: full width, pinned to the bottom
    // edge. Left open so the screenshot shows it.
    const dialog = page.locator('[role="dialog"]').first();
    await dialog.waitFor({ timeout: 5_000 });
    await page.waitForTimeout(600);
    const box = await dialog.boundingBox();
    const viewport = page.viewportSize();
    const ok = Boolean(box && viewport && Math.abs(box.y + box.height - viewport.height) < 2 && box.width >= viewport.width - 1);
    return { ok, detail: box ? `x ${box.x} y ${box.y} w ${box.width} h ${box.height}` : 'no dialog box' };
  },
  /* ---- write flows: save something, see it, remove it --------------------- */
  /* The seed makes no herbs, questionnaires or invoices, so the walk skips
     their detail pages. These flows make one standing row of each on the
     sandbox — created on the first run, only opened on later ones — and
     the next plain run then opens billing/[id], forms/[id], herbs/[id]. */
  async writeHerb(page) {
    const name = 'בדיקה אוטומטית';
    // The list is already filtered by the search term; any herb row means it exists.
    const existing = page.locator('main a[href*="/reference/herbs/"]:not([href$="/new"])').first();
    if ((await existing.count()) > 0) return { ok: true, detail: 'standing test herb already there' };
    await page.goto(new URL('/he/reference/herbs/new', page.url()).href, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.fill('#pinyin_name', 'Ce Shi Cao');
    await page.fill('#hebrew_name', name);
    await page.click('form button[type="submit"]');
    const created = await page.waitForURL(/\/reference\/herbs\/[0-9a-f-]{36}$/, { timeout: 15_000 }).then(() => true).catch(() => false);
    return { ok: created, detail: created ? 'created the standing test herb' : 'stayed on ' + page.url() };
  },
  async writeForm(page) {
    const name = 'שאלון בדיקה אוטומטית';
    const existing = page.locator('main a[href*="/forms/"]', { hasText: name }).first();
    if ((await existing.count()) > 0) return { ok: true, detail: 'standing test questionnaire already there' };
    await page.goto(new URL('/he/forms/new', page.url()).href, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.fill('#form_title', name);
    await page.locator('main button', { hasText: /הוספת שאלה/ }).first().click();
    await page.locator('input[id^="label-"]').first().fill('איך אתם מרגישים היום?');
    await page.locator('main button', { hasText: /^שמירה$/ }).last().click();
    const created = await page.waitForURL(/\/forms\/[0-9a-f-]{36}$/, { timeout: 15_000 }).then(() => true).catch(() => false);
    return { ok: created, detail: created ? 'created the standing test questionnaire' : 'stayed on ' + page.url() };
  },
  async writeInvoice(page) {
    // Invoice rows only: the page also links to /billing/new and /billing/settings.
    const rows = page.locator('main a[href*="/billing/"]:not([href*="/billing/new"]):not([href*="/billing/settings"])');
    if ((await rows.count()) > 0) return { ok: true, detail: 'an invoice already exists' };
    await page.goto(new URL('/he/billing/new', page.url()).href, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    const field = page.locator('main [role="combobox"]').first();
    await field.fill('א');
    const option = page.locator('[role="option"]').first();
    await option.waitFor({ timeout: 5_000 });
    await option.click();
    await page.locator('main button[type="submit"]').first().click();
    const created = await page.waitForURL(/\/billing\/[0-9a-f-]{36}$/, { timeout: 15_000 }).then(() => true).catch(() => false);
    const editor = created ? await page.locator('main h1').first().textContent().catch(() => '') : '';
    return { ok: created, detail: created ? 'opened a blank invoice: ' + (editor ?? '').trim() : 'stayed on ' + page.url() };
  },
  async writeSchedule(page) {
    // Sunday to Thursday, nine to five. The sandbox had no working hours, so
    // the diary hinted at it on every screen and the public page had nothing
    // to offer. Idempotent: a day already open is left as it is.
    const toast = (pattern) => page.locator('[role="status"], [role="alert"]', { hasText: pattern }).first().waitFor({ timeout: 10_000 }).then(() => true).catch(() => false);
    let opened = 0;
    for (const day of ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי']) {
      const toggle = page.locator(`main button[role="switch"][aria-label="${day}"]`).first();
      if ((await toggle.count()) === 0) return { ok: false, detail: 'no switch for ' + day };
      if ((await toggle.getAttribute('aria-checked')) === 'true') continue;
      await toggle.click();
      opened += 1;
      // Its hour selects appear once the day is on.
      // (`has` is resolved inside the row, so the inner locator must not start at <main>.)
      const row = page.locator('main li', { has: page.locator(`button[role="switch"][aria-label="${day}"]`) });
      await row.locator('select[aria-label^="משעה"]').first().waitFor({ timeout: 5_000 });
      await row.locator('select[aria-label^="משעה"]').nth(0).selectOption('09');
      await row.locator('select[aria-label^="משעה"]').nth(1).selectOption('00');
      await row.locator('select[aria-label^="עד שעה"]').nth(0).selectOption('17');
      await row.locator('select[aria-label^="עד שעה"]').nth(1).selectOption('00');
    }
    if (opened === 0) return { ok: true, detail: 'working week already set' };
    await page.locator('main button', { hasText: /^שמירה$/ }).first().click();
    const saved = await toast(/נשמר/);
    return { ok: saved, detail: saved ? `opened ${opened} days, 09:00–17:00` : 'no "saved" toast after setting hours' };
  },
  async writeBookingSettings(page) {
    const toast = (pattern) => page.locator('[role="status"], [role="alert"]', { hasText: pattern }).first().waitFor({ timeout: 10_000 }).then(() => true).catch(() => false);
    const slug = await page.locator('#booking_slug').inputValue().catch(() => '');
    if (!slug) return { ok: false, detail: 'no booking handle on the page' };
    sandbox.bookingSlug = slug;
    const toggle = page.locator('main button[role="switch"][aria-label="הדף פעיל"]').first();
    if ((await toggle.getAttribute('aria-checked')) === 'true') return { ok: true, detail: 'public page already on: /book/' + slug };
    await toggle.click();
    await page.locator('main button', { hasText: /^שמירה$/ }).last().click();
    const saved = await toast(/נשמר/);
    return { ok: saved, detail: saved ? 'public page switched on: /book/' + slug : 'no "saved" toast after switching the page on' };
  },
  async writeBookableType(page) {
    // The public page offers only treatment types opened for online booking;
    // the sandbox had none, so it greeted patients with "nothing to book yet".
    const toast = (pattern) => page.locator('[role="status"], [role="alert"]', { hasText: pattern }).first().waitFor({ timeout: 10_000 }).then(() => true).catch(() => false);
    // The section is folded by default; its summary opens it.
    const summary = page.locator('main summary', { hasText: /סוגי טיפולים/ }).first();
    if ((await summary.count()) > 0 && !(await summary.locator('xpath=..').getAttribute('open'))) await summary.click();
    const label = page.locator('main label', { hasText: /פתוח לזימון אונליין/ }).first();
    await label.waitFor({ timeout: 5_000 }).catch(() => {});
    if ((await label.count()) === 0) return { ok: false, detail: 'no treatment type on the page to open for booking' };
    const box = label.locator('input[type="checkbox"]');
    if (await box.isChecked()) return { ok: true, detail: 'first treatment type already open for online booking' };
    await box.check();
    // The nearest box around that label that also holds a save button is its row.
    const row = label.locator('xpath=ancestor::*[.//button[normalize-space()="שמירה"]][1]');
    await row.locator('button', { hasText: /^שמירה$/ }).first().click();
    const saved = await toast(/נשמר/);
    return { ok: saved, detail: saved ? 'first treatment type opened for online booking' : 'no toast after saving the type' };
  },
  async writeBooking(page) {
    // The patient's side: pick a treatment, a day with free hours, an hour,
    // leave details, land on the confirmation page and say "I will come".
    const first = page.locator('main button', { hasText: /טיפול|דיקור|ייעוץ|פגישה|Treatment/ }).first();
    if ((await page.locator('#book-what').count()) > 0 && (await first.count()) > 0) await first.click();
    // The days are pressed buttons in a group, not tabs: nothing switches panels.
    const tabs = page.locator('main [role="group"][aria-label] button[aria-pressed]');
    await tabs.first().waitFor({ timeout: 10_000 });
    let slot = null;
    for (let index = 0; index < Math.min(await tabs.count(), 10); index += 1) {
      await tabs.nth(index).click();
      // Either the grid of hours or the "no free hours" line settles the day.
      const grid = page.locator('main ul li button[dir="ltr"]');
      const none = page.locator('main', { hasText: /אין שעות פנויות/ });
      await Promise.race([grid.first().waitFor({ timeout: 8_000 }), none.waitFor({ timeout: 8_000 })]).catch(() => {});
      if ((await grid.count()) > 0) { slot = grid.first(); break; }
    }
    if (!slot) return { ok: false, detail: 'no free hour in the first ten days although the working week is set' };
    const hour = ((await slot.textContent()) ?? '').trim();
    await slot.click();
    await page.fill('#first_name', 'בדיקה');
    await page.fill('#last_name', 'זימון');
    await page.fill('#phone', '050-0000098');
    await page.locator('main button[type="submit"]').first().click();
    const landed = await page.waitForURL(/\/confirm\/[0-9a-f-]{36}/, { timeout: 20_000 }).then(() => true).catch(() => false);
    if (!landed) {
      const error = await page.locator('main [role="alert"]').first().textContent().catch(() => '');
      return { ok: false, detail: 'booking did not reach the confirmation page: ' + (error ?? '').trim() + ' @ ' + page.url() };
    }
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    const bookedNote = (await page.locator('main', { hasText: /התור נקבע/ }).count()) > 0;
    // The calendar file behind "add to calendar": the same token, as text/calendar.
    const icsHref = await page.locator('main a[href*="/ics"]').first().getAttribute('href').catch(() => null);
    const icsType = icsHref
      ? await page.request.get(new URL(icsHref, page.url()).toString()).then((r) => r.headers()['content-type'] ?? '').catch(() => '')
      : '';
    if (!icsType.includes('text/calendar')) return { ok: false, detail: `calendar file: ${icsHref ?? 'no link'} → ${icsType || 'no response'}` };
    await page.locator('main button', { hasText: /^אגיע$/ }).first().click();
    const thanked = await page.locator('main', { hasText: /ההגעה אושרה/ }).waitFor({ timeout: 10_000 }).then(() => true).catch(() => false);
    return { ok: bookedNote && thanked, detail: `booked ${hour}, confirmation page ${bookedNote ? 'showed the booking' : 'missing the booked note'}, arrival ${thanked ? 'confirmed' : 'not acknowledged'}` };
  },
  async writeEncounter(page) {
    const toast = (pattern) => page.locator('[role="status"], [role="alert"]', { hasText: pattern }).first().waitFor({ timeout: 10_000 }).then(() => true).catch(() => false);
    await page.locator('main [role="combobox"]').first().fill('בדיקה');
    const option = page.locator('[role="option"]', { hasText: 'בדיקה' }).first();
    await option.waitFor({ timeout: 5_000 });
    await option.click();
    await page.locator('main button', { hasText: /פתיחת טיפול/ }).first().click();
    const opened = await page.waitForURL(/\/encounters\/[0-9a-f-]{36}$/, { timeout: 20_000 }).then(() => true).catch(() => false);
    if (!opened) return { ok: false, detail: 'new treatment did not open: ' + page.url() };
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    const text = 'תלונה לבדיקה ' + Date.now();
    await page.fill('#chief_complaint', text);
    await page.locator('main button', { hasText: /^שמירה$/ }).first().click();
    if (!(await toast(/הטיפול נשמר/))) return { ok: false, detail: 'no "saved" toast after manual save' };
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    const kept = (await page.locator('#chief_complaint').inputValue().catch(() => '')) === text;
    if (!kept) return { ok: false, detail: 'chief complaint did not survive a reload' };
    // Autosave: type, then wait for the interval (45 s) to write it.
    await page.fill('#chief_complaint', text + ' — עריכה');
    const auto = await page.locator('main', { hasText: /נשמר אוטומטית ב-/ }).waitFor({ timeout: 60_000 }).then(() => true).catch(() => false);
    return { ok: auto, detail: auto ? 'saved, survived a reload, autosaved within a minute' : 'saved and reloaded, but no autosave line within 60 s' };
  },
  async writeInvoiceLine(page) {
    const toast = (pattern) => page.locator('[role="status"], [role="alert"]', { hasText: pattern }).first().waitFor({ timeout: 10_000 }).then(() => true).catch(() => false);
    // A fresh invoice each run: a paid one locks, and a locked one has nothing to test.
    await page.locator('main [role="combobox"]').first().fill('בדיקה');
    const option = page.locator('[role="option"]', { hasText: 'בדיקה' }).first();
    await option.waitFor({ timeout: 5_000 });
    await option.click();
    await page.locator('main button[type="submit"]').first().click();
    const opened = await page.waitForURL(/\/billing\/[0-9a-f-]{36}$/, { timeout: 20_000 }).then(() => true).catch(() => false);
    if (!opened) return { ok: false, detail: 'blank invoice did not open: ' + page.url() };
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    const row = page.locator('main div.border-t', { has: page.locator('input[type="number"]') }).first();
    await row.locator('input:not([type="number"])').first().fill('בדיקה אוטומטית');
    await row.locator('input[type="number"]').nth(0).fill('2');
    await row.locator('input[type="number"]').nth(1).fill('75');
    await row.locator('button', { hasText: /הוספת שורה/ }).click();
    if (!(await toast(/נשמר/))) return { ok: false, detail: 'no toast after adding a line' };
    const total = await page.locator('main', { hasText: /150/ }).waitFor({ timeout: 10_000 }).then(() => true).catch(() => false);
    if (!total) return { ok: false, detail: '2 × 75 did not show a total of 150 within 10 s' };
    await page.fill('#payment_amount', '50');
    // The innermost box that holds both the amount field and its save button.
    const collect = page
      .locator('main div', { has: page.locator('#payment_amount') })
      .filter({ has: page.locator('button', { hasText: /^שמירה$/ }) })
      .last();
    await collect.locator('button', { hasText: /^שמירה$/ }).first().click();
    if (!(await toast(/נשמר/))) return { ok: false, detail: 'no toast after recording a payment' };
    const outstanding = await page.locator('main', { hasText: /100/ }).waitFor({ timeout: 10_000 }).then(() => true).catch(() => false);
    return { ok: outstanding, detail: outstanding ? 'line 2 × 75 = 150, paid 50, 100 outstanding' : 'after paying 50 of 150 the page shows no 100' };
  },
  /* ---- the three routes under /api that a browser reaches through a link -- */
  async writeFeed(page) {
    // The private calendar address: made from the button if there is none,
    // then fetched as Google Calendar or an iPhone would fetch it.
    const field = page.locator('main input[aria-label="כתובת היומן"]').first();
    if ((await field.count()) === 0 || !(await field.inputValue())) {
      await page.locator('main button', { hasText: /יצירת כתובת ליומן/ }).first().click();
      await field.waitFor({ timeout: 10_000 });
      await page.waitForFunction(() => Boolean(document.querySelector('main input[aria-label="כתובת היומן"]')?.value), null, { timeout: 10_000 }).catch(() => {});
    }
    const url = await field.inputValue();
    if (!url) return { ok: false, detail: 'no calendar address after pressing the button' };
    const response = await page.request.get(url);
    const type = response.headers()['content-type'] ?? '';
    const body = await response.text();
    const ok = response.status() === 200 && type.includes('text/calendar') && body.includes('BEGIN:VCALENDAR');
    return { ok, detail: `feed ${response.status()} ${type} ${body.includes('BEGIN:VEVENT') ? 'with events' : 'without events'}` };
  },
  async writeDocument(page) {
    const toast = (pattern) => page.locator('[role="status"], [role="alert"]', { hasText: pattern }).first().waitFor({ timeout: 10_000 }).then(() => true).catch(() => false);
    await page.locator('[role="tab"]', { hasText: /מסמכים/ }).first().click();
    const input = page.locator('main input[type="file"]').first();
    await input.waitFor({ timeout: 10_000 });
    // A one-pixel PNG, generated here: nothing on disk, nothing to clean up.
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    await input.setInputFiles({ name: 'smoke-pixel.png', mimeType: 'image/png', buffer: png });
    await page.locator('#doc_category').selectOption('other').catch(() => {});
    await page.locator('main form:has(input[type="file"]) button[type="submit"]').first().click();
    if (!(await toast(/המסמך הועלה/))) return { ok: false, detail: 'no "uploaded" toast' };
    const row = page.locator('main tr', { hasText: 'smoke-pixel.png' }).first();
    await row.waitFor({ timeout: 10_000 });
    const link = row.locator('a[href^="/api/documents/"]').first();
    await link.waitFor({ timeout: 10_000 });
    const href = await link.getAttribute('href');
    const response = await page.request.get(new URL(href, page.url()).href);
    const type = response.headers()['content-type'] ?? '';
    const ok = response.status() === 200 && type.startsWith('image/png');
    return { ok, detail: `uploaded a PNG; download answered ${response.status()} ${type}` };
  },
  async exportPatientFile(page) {
    await page.locator('[role="tab"]', { hasText: /הסכמות/ }).first().click();
    const link = page.locator('main a[href$="/export"]').first();
    await link.waitFor({ timeout: 10_000 });
    const href = await link.getAttribute('href');
    const response = await page.request.get(new URL(href, page.url()).href);
    const type = response.headers()['content-type'] ?? '';
    const body = await response.text();
    const ok = response.status() === 200 && type.includes('application/json') && body.includes('בדיקה');
    return { ok, detail: `export answered ${response.status()} ${type}, ${Math.round(body.length / 1024)} KB${ok ? ', names the patient' : ''}` };
  },
  async writePatient(page) {
    // One standing test patient, edited on every run rather than a new one
    // per run: the search finds it, or the first run creates it.
    const name = 'בדיקה אוטומטית';
    const stamp = new Date().toISOString().slice(0, 16);
    const existing = page.locator('main a[href*="/patients/"]', { hasText: name }).first();
    if ((await existing.count()) > 0) {
      await existing.click();
      await page.waitForURL(/\/patients\/[0-9a-f-]{36}$/, { timeout: 15_000 });
      await page.locator('main a[href$="/edit"]').first().click();
      await page.waitForURL(/\/edit$/, { timeout: 15_000 });
      await page.fill('#occupation', `smoke ${stamp}`);
      await page.click('form button[type="submit"]');
      const saved = await page.locator('[role="status"], [role="alert"]', { hasText: /נשמר|Saved/ }).first().waitFor({ timeout: 10_000 }).then(() => true).catch(() => false);
      return { ok: saved, detail: saved ? 'edited the standing test patient' : 'no "saved" toast after edit: ' + page.url() };
    }
    await page.goto(new URL('/he/patients/new', page.url()).href, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.fill('#first_name', 'בדיקה');
    await page.fill('#last_name', 'אוטומטית');
    // A phone in a range no carrier allocates, like the seed's own.
    await page.fill('#phone', '050-0000099');
    await page.fill('#occupation', `smoke ${stamp}`);
    await page.click('form button[type="submit"]');
    const created = await page.waitForURL(/\/patients\/[0-9a-f-]{36}$/, { timeout: 15_000 }).then(() => true).catch(() => false);
    const h1 = (await page.locator('h1').first().textContent().catch(() => '')) ?? '';
    return { ok: created && h1.includes('בדיקה'), detail: created ? 'created: ' + h1.trim() : 'stayed on ' + page.url() };
  },
  async writeTask(page) {
    const title = `בדיקה אוטומטית ${Date.now()}`;
    const input = page.getByPlaceholder('מה צריך לעשות?').first();
    await input.fill(title);
    await input.press('Enter');
    const row = page.locator('main li', { hasText: title }).first();
    const appeared = await row.waitFor({ timeout: 10_000 }).then(() => true).catch(() => false);
    if (!appeared) return { ok: false, detail: 'task never appeared in the widget' };
    // Deleting is optimistic: the row must be gone from the list at once,
    // long before the widget has re-read its tasks, and the other rows must
    // stay usable while it is written.
    const others = page.locator('main li input[type="checkbox"]:not([disabled])');
    const usableBefore = await others.count();
    await row.locator('button[aria-label^="מחיקת המשימה"]').first().click();
    const goneAtOnce = await row.waitFor({ state: 'detached', timeout: 150 }).then(() => true).catch(() => false);
    const usableDuring = await others.count();
    const gone = goneAtOnce || (await row.waitFor({ state: 'detached', timeout: 10_000 }).then(() => true).catch(() => false));
    await page.waitForTimeout(1500);
    const stillGone = (await page.locator('main li', { hasText: title }).count()) === 0;
    const ok = gone && stillGone && (usableBefore === 0 || usableDuring >= usableBefore - 1);
    return { ok, detail: `gone at once ${goneAtOnce}, gone ${gone}, still gone after the re-read ${stillGone}, other rows usable ${usableDuring}/${usableBefore}` };
  },
  async writeAppointment(page) {
    // Books tomorrow 10:00 for the first patient the list offers, sees it
    // drawn on the day, and deletes it. A 10:00 left over from an earlier
    // run is deleted first, or the booking would collide with it.
    const toast = (pattern) => page.locator('[role="status"], [role="alert"]', { hasText: pattern }).first().waitFor({ timeout: 10_000 }).then(() => true).catch(() => false);
    const blockAtTen = () => page.locator('main button.absolute', { hasText: '10:00' }).first();
    const deleteBlock = async (block) => {
      // A click on a block opens its details; the edit form is a button in there.
      await block.click();
      const details = page.locator('[role="dialog"]').first();
      await details.waitFor({ timeout: 5_000 });
      await details.locator('button', { hasText: /עריכת התור/ }).first().click();
      const deleteButton = page.locator('[role="dialog"] button', { hasText: /^מחיקה$/ }).first();
      await deleteButton.waitFor({ timeout: 5_000 });
      await deleteButton.click();
      await page.locator('[role="dialog"]').last().locator('button', { hasText: /^מחיקה$/ }).last().click();
      return toast(/התור נמחק/);
    };

    const dialog = page.locator('[role="dialog"]').first();
    await dialog.waitFor({ timeout: 5_000 });
    if ((await blockAtTen().count()) > 0) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      if (!(await deleteBlock(blockAtTen()))) return { ok: false, detail: 'could not clear a leftover 10:00 booking' };
      await blockAtTen().waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {});
      await page.locator('main a[href*="new=1"], main button', { hasText: /תור חדש/ }).first().click();
      await dialog.waitFor({ timeout: 5_000 });
    }

    await dialog.locator('#patient_id').fill('א');
    const option = page.locator('[role="option"]').first();
    await option.waitFor({ timeout: 5_000 });
    const chosen = ((await option.textContent()) ?? '').trim();
    await option.click();
    // The day in the shared date field (typed as dd/mm/yyyy), the hour and
    // the minute from the two lists beside it; the end follows the start.
    const day = new URL(page.url()).searchParams.get('date');
    const [year, month, date] = day.split('-');
    await page.fill('#start_at', `${date}/${month}/${year}`);
    await page.locator('#start_at').press('Tab');
    const startTime = dialog.locator('[role="group"][aria-label="התחלה"], [role="group"][aria-label="Starts"]').first();
    await startTime.locator('select').nth(0).selectOption('10');
    await startTime.locator('select').nth(1).selectOption('00');
    await dialog.locator('button[type="submit"]').click();
    if (!(await toast(/התור נקבע/))) return { ok: false, detail: 'no "booked" toast; dialogs open: ' + (await page.locator('[role="dialog"]').count()) };

    // The diary redraws through a server refresh, which in dev takes a moment.
    const drawn = await blockAtTen().waitFor({ timeout: 15_000 }).then(() => true).catch(() => false);
    if (!drawn) return { ok: false, detail: 'booked, but the appointment is not drawn on the day within 15 s' };
    const removed = await deleteBlock(blockAtTen());
    return { ok: removed, detail: removed ? `booked ${chosen} at 10:00, saw it drawn, deleted it` : 'delete gave no toast' };
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
  async phoneTabBar(page) {
    // Four tabs and "more" at the bottom of a phone's screen; "more" opens
    // the drawer, Escape closes it and hands focus back to the button.
    const bar = page.locator('[data-tab-bar]');
    if ((await bar.count()) !== 1) return { ok: false, detail: 'no tab bar' };
    const box = await bar.boundingBox();
    const viewport = page.viewportSize();
    const atBottom = Boolean(box && viewport && Math.abs(box.y + box.height - viewport.height) < 2);
    const links = await bar.locator('a').count();
    const more = bar.locator('button[aria-haspopup="dialog"]');
    await more.click();
    const dialog = page.locator('[role="dialog"]').first();
    await dialog.waitFor({ timeout: 5_000 });
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    const gone = await dialog.waitFor({ state: 'detached', timeout: 3_000 }).then(() => true).catch(() => false);
    await page.waitForTimeout(200);
    const focusBack = await page.evaluate(() => document.activeElement?.getAttribute('aria-haspopup') === 'dialog');
    const ok = atBottom && links === 4 && gone && focusBack;
    return { ok, detail: `at bottom ${atBottom}, tabs ${links}, drawer closed ${gone}, focus back ${focusBack}` };
  },
  async largeTitleCollapses(page) {
    // Scrolled down, the page's title shows in the top bar; scrolled back, it
    // does not. The heading itself stays the page's one h1 throughout.
    const heading = await page.locator('[data-page-title]').first().textContent().catch(() => null);
    const before = await page.locator('[data-collapsing-title][data-collapsed]').count();
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(500);
    const scrolled = await page.evaluate(() => window.scrollY);
    if (scrolled < 200) return { ok: true, detail: `page too short to scroll (${scrolled}px)` };
    const shown = page.locator('[data-collapsing-title][data-collapsed]');
    const after = await shown.count();
    const text = after ? (await shown.first().textContent()) ?? '' : '';
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    const again = await page.locator('[data-collapsing-title][data-collapsed]').count();
    const ok = before === 0 && after === 1 && again === 0 && text.trim() === (heading ?? '').trim();
    return { ok, detail: `collapsed before ${before}, after ${after}, back ${again}; "${text.trim()}" vs "${(heading ?? '').trim()}"` };
  },
  async sidebarNoShift(page) {
    // The folded sidebar is folded before React runs (the width was measured
    // at domcontentloaded, in `before`), and stays folded after.
    const early = page.__sidebarEarly ?? null;
    const late = await page.evaluate(() => {
      const panel = document.querySelector('[data-sidebar-panel]');
      return { width: panel ? Math.round(panel.getBoundingClientRect().width) : null, attr: document.documentElement.dataset.sidebar ?? null };
    });
    const ok = early?.width === 56 && late.width === 56 && late.attr === 'collapsed';
    return { ok, detail: `width at domcontentloaded ${early?.width ?? '?'} (attr ${early?.attr ?? '?'}), after load ${late.width} (attr ${late.attr})` };
  },
  async cardRowTap(page) {
    // On a phone a list row is a card, and the whole card is the link — a
    // tap on the label of a value, well away from the name, opens the file.
    const card = page.locator('.table-cards tbody tr').first();
    if ((await card.count()) === 0) return { ok: false, detail: 'no card rows' };
    const cell = card.locator('td').nth(1);
    const box = await cell.boundingBox();
    if (!box) return { ok: false, detail: 'second cell has no box' };
    const rtl = (await page.evaluate(() => document.documentElement.dir)) === 'rtl';
    // The label sits at the inline start of the cell: the right in Hebrew.
    await page.mouse.click(rtl ? box.x + box.width - 16 : box.x + 16, box.y + box.height / 2);
    const opened = await page.waitForURL(/\/patients\/[0-9a-f-]{36}/, { timeout: 10_000 }).then(() => true).catch(() => false);
    return { ok: opened, detail: opened ? 'the card opened the file' : `still at ${page.url()}` };
  },
  async phoneFilterSheet(page) {
    // The catalogue's filters are a drawer on a phone, opened from one button.
    // The button replaces the desk's <details> after hydration; give a busy
    // machine a moment for that.
    const button = page.locator('main button[aria-haspopup="dialog"]', { hasText: /סינון|Filter/ }).first();
    const present = await button.waitFor({ timeout: 8_000 }).then(() => true).catch(() => false);
    if (!present) return { ok: false, detail: 'no filter button on the phone layout' };
    await button.click();
    const dialog = page.locator('[role="dialog"]').first();
    await dialog.waitFor({ timeout: 5_000 });
    const fieldsets = await dialog.locator('fieldset').count();
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    const gone = await dialog.waitFor({ state: 'detached', timeout: 3_000 }).then(() => true).catch(() => false);
    return { ok: fieldsets > 0 && gone, detail: `${fieldsets} filter groups in the drawer, closed ${gone}` };
  },
  async calendarPhoneDay(page) {
    // Asked for by a phone (the user agent was rewritten in `before`), the
    // diary is a single day from the first byte — no week drawn and swapped.
    const columns = await page.locator('[data-time-grid] > div > div').first().locator(':scope > div').count();
    const url = new URL(page.url());
    const ok = columns === 2 && !url.searchParams.has('view');
    return { ok, detail: `${columns - 1} day column(s), view param ${url.searchParams.get('view') ?? 'none'}` };
  },
  async calendarScrollToNow(page) {
    // The clock was fixed at 11:00 in `before`: the panel must have scrolled
    // so the now line is in view rather than starting at seven in the morning.
    const panel = page.locator('[data-time-grid]');
    if ((await panel.count()) === 0) return { ok: false, detail: 'no time grid' };
    await page.waitForTimeout(600);
    const state = await panel.evaluate((el) => {
      const line = el.querySelector('.bg-red-600');
      const box = line?.parentElement?.getBoundingClientRect();
      const panelBox = el.getBoundingClientRect();
      return { scrollTop: Math.round(el.scrollTop), inView: Boolean(box && box.top >= panelBox.top && box.top <= panelBox.bottom), hasLine: Boolean(line) };
    });
    const ok = state.hasLine && state.scrollTop > 0 && state.inView;
    return { ok, detail: `now line ${state.hasLine}, scrollTop ${state.scrollTop}, in view ${state.inView}` };
  },
  async dashboardNoSpinners(page) {
    // Widgets arrive with their numbers: nothing spins after the document
    // has loaded, because the page computed the first paint on the server.
    const spinners = await page.locator('main .animate-spin').count();
    const stats = await page.locator('main [data-widget]').count();
    return { ok: spinners === 0 && stats > 0, detail: `${spinners} spinner(s) over ${stats} widget(s)` };
  },
  async bookingSteps(page) {
    // The public booking page says where you are: a step meter with a
    // progressbar, "back" only where there is somewhere to go.
    const meter = page.locator('main [role="progressbar"]');
    if ((await meter.count()) === 0) return { ok: true, detail: 'one screen only (nothing to choose); no meter by design' };
    const now = await meter.getAttribute('aria-valuenow');
    const max = await meter.getAttribute('aria-valuemax');
    const back = page.locator('main button', { hasText: /^חזרה$|^Back$/ });
    // With one treatment and one practitioner the page opens on the time
    // step: two steps, no "back". With a choice to make, choosing it moves
    // the meter to 2 and "back" appears.
    const choosing = (await page.locator('#book-what').count()) > 0;
    if (!choosing) {
      const ok = now === '1' && max === '2' && (await back.count()) === 0;
      return { ok, detail: `no choice to make: step ${now} of ${max}, back buttons ${await back.count()}` };
    }
    const first = page.locator('main button', { hasText: /טיפול|דיקור|ייעוץ|פגישה|Treatment/ }).first();
    if ((await first.count()) > 0) await first.click();
    await page.waitForTimeout(400);
    const after = await meter.getAttribute('aria-valuenow');
    const ok = now === '1' && Number(max) >= 2 && after === '2' && (await back.count()) === 1;
    return { ok, detail: `step ${now} of ${max}, then ${after}; back buttons ${await back.count()}` };
  },
  async printPreview(page) {
    // Under print media the shell's furniture is gone, every scrolling panel
    // is whole, and a table is a table even at a phone's width.
    await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(300);
    const state = await page.evaluate(() => {
      const hidden = (selector) => {
        const el = document.querySelector(selector);
        return el ? getComputedStyle(el).display === 'none' : null;
      };
      const panel = document.querySelector('[data-scroll-panel], [data-time-grid]');
      const cell = document.querySelector('.table-cards td');
      return {
        tabBar: hidden('[data-tab-bar]'),
        topBar: hidden('[data-top-bar]'),
        noPrint: hidden('.no-print'),
        panelOverflow: panel ? getComputedStyle(panel).overflowY : null,
        cellDisplay: cell ? getComputedStyle(cell).display : null,
      };
    });
    await page.emulateMedia({ media: null });
    const ok =
      state.tabBar !== false &&
      state.topBar !== false &&
      state.noPrint !== false &&
      (state.panelOverflow === null || state.panelOverflow === 'visible') &&
      (state.cellDisplay === null || state.cellDisplay === 'table-cell');
    return { ok, detail: JSON.stringify(state) };
  },
  async herbGallery(page) {
    // A thumbnail opens the herb large with a zoom frame; the search box in
    // the sheet puts a second herb beside it; Escape closes.
    const thumb = page.locator('main button[aria-label^="הגדלת"], main button[aria-label^="Enlarge"]').first();
    if ((await thumb.count()) === 0) return { ok: false, detail: 'no thumbnail buttons in the list' };
    await thumb.click();
    const dialog = page.locator('[role="dialog"]').first();
    await dialog.waitFor({ timeout: 5_000 });
    await page.waitForTimeout(500);
    const one = await dialog.locator('[role="group"][aria-label]').count();
    const box = dialog.locator('#herb-gallery-pick');
    await box.fill('a');
    const option = page.locator('[role="option"]').first();
    const offered = await option.waitFor({ timeout: 5_000 }).then(() => true).catch(() => false);
    if (offered) await option.click();
    await page.waitForTimeout(500);
    const two = await dialog.locator('[role="group"][aria-label]').count();
    // The second picture's grip, moved with the keyboard, puts it first:
    // Space picks it up, an arrow towards the start moves it (right in the
    // Hebrew row; up in the phone's stack), Space drops it.
    const names = () => dialog.locator('figcaption button[data-herb-name]').allInnerTexts();
    const before = await names();
    const grip = dialog.locator('figure').nth(1).locator('button[data-drag-handle]');
    if ((await grip.count()) > 0) {
      await grip.focus();
      await page.keyboard.press('Space');
      await page.waitForTimeout(200);
      await page.keyboard.press((page.viewportSize()?.width ?? 1280) < 640 ? 'ArrowUp' : 'ArrowRight');
      await page.waitForTimeout(200);
      await page.keyboard.press('Space');
    }
    await page.waitForTimeout(400);
    const after = await names();
    const reordered = before.length === 2 && after[0] === before[1] && after[1] === before[0];
    // A name opens the monograph in a second window over the first; Escape
    // closes only that one.
    await dialog.locator('figcaption button[data-herb-name]').first().click();
    const inner = page.locator('[role="dialog"]').nth(1);
    const monograph = await inner.waitFor({ timeout: 8_000 }).then(() => true).catch(() => false);
    let loaded = false;
    if (monograph) {
      loaded = await inner.locator('[data-monograph-loaded]').waitFor({ timeout: 15_000 }).then(() => true).catch(() => false);
      await page.keyboard.press('Escape');
      await inner.waitFor({ state: 'detached', timeout: 3_000 }).catch(() => {});
    }
    const outerStill = (await page.locator('[role="dialog"]').count()) === 1;
    await page.keyboard.press('Escape');
    const gone = await dialog.waitFor({ state: 'detached', timeout: 3_000 }).then(() => true).catch(() => false);
    const ok = one === 1 && two === 2 && reordered && monograph && loaded && outerStill && gone;
    return {
      ok,
      detail: `frames ${one} then ${two}, option offered ${offered}, reordered ${reordered}, monograph ${monograph}/${loaded}, outer kept ${outerStill}, closed ${gone}`,
    };
  },
  async writeInvite(page) {
    // An owner makes an invitation link; a stranger opening it sees the
    // clinic's name and the way in; the owner cancels it; the stranger now
    // sees that it is closed. No account is created.
    const create = page.locator('main button', { hasText: /יצירת קישור הזמנה/ }).first();
    if ((await create.count()) === 0) return { ok: false, detail: 'no invite button (not an owner?)' };
    await page.fill('#invite-name', 'Smoke invitee');
    await create.click();
    const link = page.locator('main input[aria-label="קישור ההזמנה"]').first();
    await link.waitFor({ timeout: 10_000 });
    const url = await link.inputValue();
    if (!/\/join\/[0-9a-f-]{36}$/.test(url)) return { ok: false, detail: `link ${url}` };
    const stranger = await current.browser.newContext({ locale: 'he-IL', viewport: { width: 1280, height: 900 } });
    const guest = await stranger.newPage();
    await guest.goto(url, { waitUntil: 'networkidle' });
    const offered = (await guest.locator('main').getByText(/קליניקת בדיקות/).count()) > 0 && (await guest.locator('main a', { hasText: /פתיחת חשבון והצטרפות/ }).count()) > 0;
    await page.locator('main button[aria-label^="ביטול ההזמנה של Smoke invitee"]').first().click();
    await page.waitForTimeout(800);
    await guest.goto(url, { waitUntil: 'networkidle' });
    const closed = (await guest.locator('main').getByText(/כבר לא פעילה/).count()) > 0;
    await stranger.close();
    const ok = offered && closed;
    return { ok, detail: `offered ${offered}, closed after cancel ${closed}` };
  },
  async pricesCheapest(page) {
    // Each row's green chip must be the lowest price among the row's live
    // chips, and every chip must leave the app safely (new tab, no opener).
    // An empty list is fine: the price tables fill only once the reader runs.
    const rows = page.locator('main tbody tr');
    const count = await rows.count();
    if (count === 0) {
      const empty = await page.locator('main').getByText(/עוד אין מחירים|לא נמצאו מוצרים/).count();
      return { ok: empty > 0, detail: `no products yet; empty state shown: ${empty > 0}` };
    }
    const problems = [];
    for (let i = 0; i < Math.min(count, 20); i++) {
      const chips = rows.nth(i).locator('a[target="_blank"]');
      const prices = [];
      for (let j = 0; j < (await chips.count()); j++) {
        const chip = chips.nth(j);
        const text = await chip.innerText();
        const struck = await chip.locator('.line-through').count();
        const value = Number((text.match(/[\d,.]+/) || [''])[0].replace(/,/g, ''));
        if (!struck && Number.isFinite(value) && value > 0) {
          prices.push({ value, cheapest: (await chip.getAttribute('data-cheapest')) !== null, rel: await chip.getAttribute('rel') });
        }
      }
      if (prices.length === 0) continue;
      const min = Math.min(...prices.map((p) => p.value));
      const marked = prices.filter((p) => p.cheapest);
      if (marked.length !== 1 || marked[0].value !== min) problems.push(`row ${i + 1}: cheapest mark ${marked.map((m) => m.value).join('/')} vs min ${min}`);
      if (prices.some((p) => !/noopener/.test(p.rel || ''))) problems.push(`row ${i + 1}: a shop link without noopener`);
    }
    return { ok: problems.length === 0, detail: problems.length ? problems.join('; ') : `${count} rows checked` };
  },
  async phoneSearchOverlay(page) {
    // On a phone the search takes the whole top bar while it is open.
    const trigger = page.locator('[data-top-bar] button[aria-label="חיפוש מהיר"], [data-top-bar] button[aria-label="Quick search"]').first();
    if ((await trigger.count()) === 0) return { ok: false, detail: 'no search button in the top bar' };
    await trigger.click();
    const input = page.locator('[data-top-bar] input[type="search"], [data-top-bar] input').first();
    await input.waitFor({ timeout: 3_000 });
    await page.waitForTimeout(400);
    const box = await input.boundingBox();
    const bar = await page.locator('[data-top-bar]').boundingBox();
    const viewport = page.viewportSize();
    const wide = Boolean(box && viewport && box.width >= viewport.width * 0.6);
    const inBar = Boolean(box && bar && box.y >= bar.y && box.y + box.height <= bar.y + bar.height + 1);
    const focused = await page.evaluate(() => document.activeElement?.tagName === 'INPUT');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    return { ok: wide && inBar && focused, detail: `input width ${Math.round(box?.width ?? 0)} of ${viewport?.width}, inside bar ${inBar}, focused ${focused}` };
  },
};

/* ---- main ---------------------------------------------------------------- */

const STATIC_ROUTES = [
  '/', '/patients', '/patients/new', '/calendar', '/calendar?view=day', '/calendar?view=month',
  '/calendar?view=range', '/tasks', '/messages', '/encounters', '/encounters/new', '/forms',
  '/forms/new', '/reference/herbs', '/reference/formulas', '/reference/points', '/reference/compare',
  '/inventory', '/inventory?tab=low', '/inventory/batches', '/inventory/batches/receive',
  '/inventory/suppliers', '/prices', '/prices?cat=needles&min=2', '/prices/credits', '/billing', '/billing/new',
  '/billing/settings', '/reports', '/assistant',
  '/settings', '/settings/team', '/settings/access', '/settings/booking', '/settings/consent', '/settings/tags',
  '/account', '/account/protocols', '/account/schedule', '/accessibility',
];
const PUBLIC_ROUTES = ['/about', '/accessibility', '/login', '/signup', '/setup', '/join/00000000-0000-4000-8000-000000000000'];

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
    // The portal's public face, if a portal is running beside the app.
    const portalUp = await fetch(`${portalUrl}/he/login`, { redirect: 'manual' }).then((r) => r.status < 500).catch(() => false);
    if (portalUp) {
      for (const locale of locales) for (const width of widths) {
        await visit(anonymous, { route: '/login', locale, width, label: 'portal /login', origin: portalUrl });
      }
    } else {
      console.log(`portal not running at ${portalUrl} — its login page was not opened`);
    }
    // Search engines: the app lets them index the booking page and nothing
    // else, the confirmation page says noindex itself, the portal allows nothing.
    await checkText('robots.txt', `${baseUrl}/robots.txt`, (text) => [
      /^Disallow:\s*\/\s*$/m.test(text) ? null : 'no "Disallow: /" line',
      /^Allow:\s*\/he\/about/m.test(text) ? null : 'the public home page is not allowed',
      /^Allow:\s*\/he\/accessibility/m.test(text) ? null : 'the accessibility statement is not allowed',
      /^Sitemap:\s*\S+\/sitemap\.xml/m.test(text) ? null : 'no sitemap line',
      /^Allow:\s*\/he\/book\//m.test(text) ? null : 'the booking page is not allowed',
    ]);
    await checkText('confirm page noindex', `${baseUrl}/he/confirm/00000000-0000-4000-8000-000000000000`, (html) => [
      /<meta name="robots" content="noindex/i.test(html) ? null : 'no noindex meta tag on the confirmation page',
    ]);
    if (portalUp) {
      await checkText('portal robots.txt', `${portalUrl}/robots.txt`, (text) => [
        /^Disallow:\s*\/\s*$/m.test(text) ? null : 'the portal is not disallowed',
      ]);
    }
    await anonymous.close();

    if (publicOnly) return;
    if (!email || !password) {
      throw new Error('SMOKE_EMAIL and SMOKE_PASSWORD are not set (apps/web/.env.test.local).');
    }

    current.browser = browser;
    let context = await login(browser);
    current.context = context;

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
      await visit(context, { route: '/prices/stores', locale, width, expect404: true });
    }

    // Flows, desktop, Hebrew: what a static read cannot judge. On a fresh
    // session — the walk above can outlast the first one.
    await context.close();
    context = await login(browser);
    current.context = context;
    const desktop = widths[0];
    const phone = widths[1];
    await visit(context, { route: '/', locale: 'he', width: desktop, label: 'flow quick-create', after: flows.quickCreate });
    await visit(context, { route: '/', locale: 'he', width: desktop, label: 'flow global-search', after: flows.globalSearch });
    await visit(context, { route: '/calendar?new=1', locale: 'he', width: desktop, label: 'flow new-appointment', after: flows.newAppointmentDialog });
    if (phone) await visit(context, { route: '/calendar?new=1', locale: 'he', width: phone, label: 'flow drawer-swipe', after: flows.drawerSwipe });
    await visit(context, { route: '/calendar?view=week', locale: 'he', width: desktop, label: 'flow block-day-escape', after: flows.blockDayThenEscape });
    await visit(context, { route: '/patients', locale: 'he', width: desktop, label: 'flow status-tile-filter', after: flows.statusTileKeepsFilter });
    await visit(context, { route: '/patients', locale: 'he', width: desktop, label: 'flow filters-remembered', after: flows.filtersRemembered });
    if (phone) await visit(context, { route: '/calendar?new=1', locale: 'he', width: phone, label: 'flow phone-dialog-drawer', after: flows.phoneDrawer });
    if (phone) {
      await visit(context, { route: '/', locale: 'he', width: phone, label: 'flow phone-tab-bar', after: flows.phoneTabBar });
      await visit(context, { route: '/patients', locale: 'en', width: phone, label: 'flow phone-tab-bar', after: flows.phoneTabBar });
      await visit(context, { route: '/reference/herbs', locale: 'he', width: phone, label: 'flow large-title-collapses', after: flows.largeTitleCollapses });
      await visit(context, { route: '/patients', locale: 'he', width: phone, label: 'flow phone-search-overlay', after: flows.phoneSearchOverlay });
      await visit(context, { route: '/patients', locale: 'he', width: phone, label: 'flow card-row-tap', after: flows.cardRowTap });
      await visit(context, { route: '/patients', locale: 'he', width: phone, label: 'flow print-preview-list', after: flows.printPreview });
      await visit(context, { route: '/calendar?view=day', locale: 'he', width: phone, label: 'flow print-preview-diary', after: flows.printPreview });
      await visit(context, { route: '/reference/herbs', locale: 'he', width: phone, label: 'flow phone-filter-sheet', after: flows.phoneFilterSheet });
    }
    if (phone) {
      await visit(context, {
        route: '/calendar', locale: 'he', width: phone, label: 'flow calendar-phone-day',
        before: (page) => page.route('**/*', (route) => {
          const headers = { ...route.request().headers(), 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' };
          return route.continue({ headers });
        }),
        after: flows.calendarPhoneDay,
      });
    }
    await visit(context, {
      route: '/calendar?view=day', locale: 'he', width: desktop, label: 'flow calendar-scroll-to-now',
      before: async (page) => {
        const eleven = new Date();
        eleven.setHours(11, 0, 0, 0);
        await page.clock.setFixedTime(eleven);
      },
      after: flows.calendarScrollToNow,
    });
    await visit(context, { route: '/', locale: 'he', width: desktop, label: 'flow dashboard-no-spinners', after: flows.dashboardNoSpinners });
    await visit(context, {
      route: '/patients', locale: 'he', width: desktop, label: 'flow sidebar-no-shift',
      before: async (page) => {
        await page.addInitScript(() => localStorage.setItem('herbalist-sidebar-collapsed', '1'));
        page.once('domcontentloaded', () => {
          page
            .evaluate(() => {
              const panel = document.querySelector('[data-sidebar-panel]');
              return { width: panel ? Math.round(panel.getBoundingClientRect().width) : null, attr: document.documentElement.dataset.sidebar ?? null };
            })
            .then((early) => { page.__sidebarEarly = early; })
            .catch(() => {});
        });
      },
      after: flows.sidebarNoShift,
    });
    await visit(context, { route: '/reference/herbs?page=2', locale: 'he', width: desktop, label: 'catalogue page 2' });
    await visit(context, { route: '/reference/herbs', locale: 'he', width: desktop, label: 'flow herb-gallery', after: flows.herbGallery });
    if (phone) await visit(context, { route: '/reference/herbs', locale: 'he', width: phone, label: 'flow herb-gallery-phone', after: flows.herbGallery });
    await visit(context, { route: '/prices', locale: 'he', width: desktop, label: 'flow prices-cheapest', after: flows.pricesCheapest });
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

    if (writeFlows) {
      const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
      await visit(context, { route: '/patients?q=%D7%91%D7%93%D7%99%D7%A7%D7%94&inactive=1', locale: 'he', width: desktop, label: 'flow write-patient', after: flows.writePatient });
      await visit(context, { route: '/', locale: 'he', width: desktop, label: 'flow write-task', after: flows.writeTask });
      await visit(context, { route: `/calendar?view=day&date=${tomorrow}&new=1`, locale: 'he', width: desktop, label: 'flow write-appointment', after: flows.writeAppointment });
      await visit(context, { route: '/reference/herbs?q=%D7%91%D7%93%D7%99%D7%A7%D7%94', locale: 'he', width: desktop, label: 'flow write-herb', after: flows.writeHerb });
      await visit(context, { route: '/forms', locale: 'he', width: desktop, label: 'flow write-form', after: flows.writeForm });
      await visit(context, { route: '/billing', locale: 'he', width: desktop, label: 'flow write-invoice', after: flows.writeInvoice });
      await visit(context, { route: '/account/schedule', locale: 'he', width: desktop, label: 'flow write-schedule', after: flows.writeSchedule });
      await visit(context, { route: '/settings/booking', locale: 'he', width: desktop, label: 'flow write-booking-settings', after: flows.writeBookingSettings });
      await visit(context, { route: '/account', locale: 'he', width: desktop, label: 'flow write-bookable-type', after: flows.writeBookableType });
      if (sandbox.bookingSlug) await visit(context, { route: `/book/${sandbox.bookingSlug}`, locale: 'he', width: desktop, label: 'flow write-booking', after: flows.writeBooking });
      // The same page on a phone, signed out, for its step meter.
      if (sandbox.bookingSlug && phone) {
        const guest = await current.browser.newContext({ locale: 'he-IL' });
        await visit(guest, { route: `/book/${sandbox.bookingSlug}`, locale: 'he', width: phone, label: 'flow booking-steps', after: flows.bookingSteps });
        await guest.close();
      }
      await visit(context, { route: '/encounters/new', locale: 'he', width: desktop, label: 'flow write-encounter', after: flows.writeEncounter });
      await visit(context, { route: '/billing/new', locale: 'he', width: desktop, label: 'flow write-invoice-line', after: flows.writeInvoiceLine });
      await visit(context, { route: '/account/schedule', locale: 'he', width: desktop, label: 'flow write-feed', after: flows.writeFeed });
      await visit(context, { route: '/settings/team', locale: 'he', width: desktop, label: 'flow write-invite', after: flows.writeInvite });
      // The standing test patient, by search: its id is not known up front.
      const testPatient = await collectIds(context, '/patients?q=%D7%91%D7%93%D7%99%D7%A7%D7%94&inactive=1', '/patients/([0-9a-f-]{36})$', 1);
      if (testPatient[0]) {
        await visit(context, { route: `/patients/${testPatient[0]}`, locale: 'he', width: desktop, label: 'flow write-document', after: flows.writeDocument });
        await visit(context, { route: `/patients/${testPatient[0]}`, locale: 'he', width: desktop, label: 'flow export-file', after: flows.exportPatientFile });
      }
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
