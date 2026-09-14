/**
 * Walks the main flows of the staff app with the keyboard alone, and reads
 * each screen the way a screen reader would.
 *
 * axe (in check-a11y.mjs and inside the smoke) judges one page at rest:
 * names, roles, contrast. It cannot tell whether a practitioner who never
 * touches the mouse can book an appointment, or what a screen reader says
 * while they do. This script — pressing only Tab, Shift+Tab, Enter, Space,
 * Escape and the arrows — signs in, edits a patient, books and deletes an
 * appointment, opens a treatment and saves it, and adds, ticks and deletes
 * a task. At every stop it records what has focus, whether the focus ring is
 * visible, whether the element is on screen and not covered, and whether it
 * has a name. On every screen it checks the landmarks, the heading order, the
 * skip link and the unnamed controls, and writes the accessibility tree of
 * <main> (and of each dialog) to a text file — to be read as a screen reader
 * would read it.
 *
 * Same gate as the smoke: it refuses to continue without the sandbox banner,
 * because it writes (a patient edit, an appointment, a treatment, a task).
 *
 * Usage:  node scripts/a11y-walk.mjs [--only=login,patient,appointment,treatment,tasks]
 * Output: test-results/a11y-walk/<timestamp>/{report.json, summary.md, snapshots/, screenshots/}
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

// Text is entered with insertText rather than keyboard.type: after a long run of
// Tab presses, Playwright's synthetic typing of Hebrew characters silently
// stopped reaching the field, while a real key event stream still would. Keys
// that matter (Tab, Enter, Space, Escape, the arrows, type-ahead in a native
// select) are still pressed.
const args = new Set(process.argv.slice(2));
const only = [...args].find((arg) => arg.startsWith('--only='))?.slice(7).split(',').filter(Boolean) ?? null;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = readEnv(path.join(root, 'apps', 'web', '.env.test.local'));
const baseUrl = (env.SMOKE_BASE_URL || process.env.SMOKE_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const email = env.SMOKE_EMAIL || process.env.SMOKE_EMAIL;
const password = env.SMOKE_PASSWORD || process.env.SMOKE_PASSWORD;
/** The sandbox banner: the run's only permission to proceed. */
const SYNTHETIC_TEXT = 'סביבת פיתוח';
const VIEWPORT = { width: 1280, height: 900 };
const TEST_PATIENT = 'בדיקה אוטומטית';

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join(root, 'test-results', 'a11y-walk', stamp);
const snapDir = path.join(outDir, 'snapshots');
const shotDir = path.join(outDir, 'screenshots');
fs.mkdirSync(snapDir, { recursive: true });
fs.mkdirSync(shotDir, { recursive: true });

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

/* ---- in the page --------------------------------------------------------- */

/**
 * Installed on every page before it runs: the accessible name and role of an
 * element, close enough to the real computation for a form-and-buttons app,
 * and a stable key so a focus stop can be recognised again later.
 */
function installHelpers() {
  const text = (node) => (node && node.textContent ? node.textContent : '').replace(/\s+/g, ' ').trim();
  const name = (e) => {
    const by = e.getAttribute('aria-labelledby');
    if (by) {
      const t = by.split(/\s+/).map((id) => text(document.getElementById(id))).filter(Boolean).join(' ');
      if (t) return t;
    }
    const label = e.getAttribute('aria-label');
    if (label && label.trim()) return label.trim();
    if (e.labels && e.labels.length) {
      const t = [...e.labels].map(text).filter(Boolean).join(' ');
      if (t) return t;
    }
    if (e.tagName === 'IMG') return (e.getAttribute('alt') || '').trim();
    if (e.tagName !== 'SELECT' && e.tagName !== 'TEXTAREA' && e.tagName !== 'INPUT') {
      const own = text(e);
      if (own) return own;
      const img = e.querySelector('img[alt]');
      if (img && img.getAttribute('alt')) return img.getAttribute('alt').trim();
      const svgTitle = e.querySelector('svg > title');
      if (svgTitle) return text(svgTitle);
    }
    return (e.getAttribute('title') || e.getAttribute('placeholder') || '').trim();
  };
  const role = (e) => {
    const explicit = e.getAttribute('role');
    if (explicit) return explicit;
    const tag = e.tagName;
    if (tag === 'A') return e.hasAttribute('href') ? 'link' : 'generic';
    if (tag === 'BUTTON' || tag === 'SUMMARY') return 'button';
    if (tag === 'SELECT') return 'combobox';
    if (tag === 'TEXTAREA') return 'textbox';
    if (tag === 'INPUT') {
      return (
        { checkbox: 'checkbox', radio: 'radio', submit: 'button', button: 'button', search: 'searchbox', number: 'spinbutton', range: 'slider' }[
          e.type
        ] || 'textbox'
      );
    }
    return tag.toLowerCase();
  };
  const key = (e) => {
    if (!e.dataset.a11yKey) {
      window.__a11yKeys = (window.__a11yKeys || 0) + 1;
      e.dataset.a11yKey = 'k' + window.__a11yKeys;
    }
    return e.dataset.a11yKey;
  };
  const visible = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const describe = (e) =>
    e.tagName.toLowerCase() +
    (e.id ? '#' + e.id : '') +
    (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  window.__a11y = { text, name, role, key, visible, describe };
}

/** What has focus right now, and whether a person could tell. */
function probeActive() {
  const A = window.__a11y;
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement || el.tagName === 'NEXTJS-PORTAL') {
    return { tag: 'body', role: '', name: '', id: '', key: 'body', ring: 'none', inView: true, coveredBy: '', inDialog: false, inMain: false };
  }
  // The design system draws every focus ring with `outline`; a box-shadow
  // here is a resting shadow, not a ring.
  const outlined = (e) => {
    const cs = getComputedStyle(e);
    return cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 && cs.outlineColor !== 'rgba(0, 0, 0, 0)';
  };
  let ring = outlined(el) ? 'self' : 'none';
  if (ring === 'none' && el.parentElement && outlined(el.parentElement)) ring = 'parent';
  if (ring === 'none' && el.parentElement?.parentElement && outlined(el.parentElement.parentElement)) ring = 'grandparent';
  const rect = el.getBoundingClientRect();
  const inView = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth;
  let coveredBy = '';
  if (inView) {
    const x = Math.min(Math.max(rect.left + rect.width / 2, 0), innerWidth - 1);
    const y = Math.min(Math.max(rect.top + rect.height / 2, 0), innerHeight - 1);
    const top = document.elementFromPoint(x, y);
    if (top && top !== el && !el.contains(top) && !top.contains(el)) coveredBy = A.describe(top);
  }
  return {
    tag: el.tagName.toLowerCase(),
    role: A.role(el),
    name: A.name(el).slice(0, 80),
    id: el.id || '',
    key: A.key(el),
    ring,
    inView,
    coveredBy,
    inDialog: Boolean(el.closest('[role="dialog"]')),
    inMain: Boolean(el.closest('main')),
    expanded: el.getAttribute('aria-expanded'),
    value: 'value' in el && typeof el.value === 'string' ? el.value.slice(0, 40) : undefined,
  };
}

/** The screen at rest: landmarks, headings, names. */
function probeScreen() {
  const A = window.__a11y;
  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
    .filter(A.visible)
    .map((h) => ({ level: Number(h.tagName[1]), text: A.text(h).slice(0, 60), inDialog: Boolean(h.closest('[role="dialog"]')) }));
  const skips = [];
  let previous = 0;
  for (const h of headings) {
    if (previous && h.level > previous + 1) skips.push(`h${previous} → h${h.level} "${h.text}"`);
    previous = h.level;
  }
  const controls = [
    ...document.querySelectorAll(
      'a[href],button,input:not([type="hidden"]),select,textarea,[role="button"],[role="link"],[role="tab"],[role="menuitem"],[role="checkbox"],[role="switch"],[role="combobox"]',
    ),
  ].filter(A.visible);
  const unnamed = controls
    .filter((e) => !A.name(e) && e.getAttribute('aria-hidden') !== 'true' && !e.closest('[aria-hidden="true"]'))
    .map((e) => A.describe(e) + (e.closest('[role="dialog"]') ? ' (dialog)' : ''))
    .slice(0, 12);
  const navs = [...document.querySelectorAll('nav')].filter(A.visible).map((n) => n.getAttribute('aria-label') || n.getAttribute('aria-labelledby') || '');
  const counts = {};
  for (const e of controls) {
    const n = A.name(e);
    if (n) counts[n] = (counts[n] || 0) + 1;
  }
  const repeated = Object.entries(counts)
    .filter(([, c]) => c >= 3)
    .map(([n, c]) => `"${n}" ×${c}`)
    .slice(0, 8);
  const images = [...document.querySelectorAll('img')].filter(A.visible);
  return {
    title: document.title,
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    mains: document.querySelectorAll('main').length,
    h1: headings.filter((h) => h.level === 1 && !h.inDialog).length,
    headings,
    skips,
    unnamed,
    navs,
    unlabeledNavs: navs.filter((label) => !label).length,
    repeated,
    imagesWithoutAlt: images.filter((i) => !i.hasAttribute('alt')).length,
    positiveTabindex: [...document.querySelectorAll('[tabindex]')].filter((e) => Number(e.getAttribute('tabindex')) > 0).length,
  };
}

/* ---- the harness --------------------------------------------------------- */

const results = [];
/** The flow being walked, so a harness failure keeps its notes. */
let currentFlow = null;

function makeFlow(name) {
  currentFlow = { name, ok: true, issues: [], notes: [], stops: [], screens: [] };
  return currentFlow;
}
function issue(flow, text) {
  flow.issues.push(text);
  flow.ok = false;
}
function note(flow, text) {
  flow.notes.push(text);
}
const describeStop = (s) => (s.tag === 'body' ? 'nowhere (the page body)' : `${s.role} "${s.name}"${s.id ? ' #' + s.id : ''}`);

async function active(page) {
  return page.evaluate(probeActive);
}

/** Moves focus for the harness's own convenience — never counted as a keyboard path. */
async function focusKey(page, key) {
  await page.evaluate((k) => document.querySelector(`[data-a11y-key="${k}"]`)?.focus(), key);
}

/** Judges one focus stop. */
function checkStop(flow, stop, where) {
  if (stop.tag === 'body') return;
  flow.stops.push({ where, ...stop });
  const label = describeStop(stop);
  if (!stop.name) issue(flow, `${where}: focus on an unnamed ${stop.tag}${stop.id ? '#' + stop.id : ''}`);
  if (stop.ring === 'none') issue(flow, `${where}: no visible focus ring on ${label}`);
  if (!stop.inView) issue(flow, `${where}: focus moved off screen, to ${label}`);
  else if (stop.coveredBy) issue(flow, `${where}: ${label} has focus but is covered by ${stop.coveredBy}`);
}

/** Presses Tab until the focused element satisfies `match`, judging every stop on the way. */
async function tabTo(page, flow, match, { where, max = 120, shift = false } = {}) {
  const seen = new Set();
  for (let i = 1; i <= max; i++) {
    await page.keyboard.press(shift ? 'Shift+Tab' : 'Tab');
    const stop = await active(page);
    if (stop.tag === 'body') continue;
    if (seen.has(stop.key)) {
      issue(flow, `${where}: cycled through ${seen.size} stops without reaching the target`);
      return null;
    }
    seen.add(stop.key);
    checkStop(flow, stop, where);
    if (match(stop)) {
      note(flow, `${where}: reached ${describeStop(stop)} after ${i} Tab${i === 1 ? '' : 's'}`);
      return stop;
    }
  }
  issue(flow, `${where}: target not reached within ${max} Tabs`);
  return null;
}

/** Every stop of a screen from the top, until the order cycles. */
async function tabWalk(page, flow, { where, max = 200 } = {}) {
  const stops = [];
  const seen = new Set();
  let bodies = 0;
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const stop = await active(page);
    if (stop.tag === 'body') {
      if (++bodies > 1) break;
      continue;
    }
    if (seen.has(stop.key)) break;
    seen.add(stop.key);
    stops.push(stop);
    checkStop(flow, stop, where);
  }
  return stops;
}

/** The screen at rest, its tree written down. */
async function screen(page, flow, label) {
  await settled(page);
  const s = await page.evaluate(probeScreen);
  flow.screens.push({ label, ...s });
  if (s.mains !== 1) issue(flow, `${label}: ${s.mains} <main> landmarks`);
  if (s.h1 !== 1) issue(flow, `${label}: ${s.h1} h1 headings`);
  for (const skip of s.skips) issue(flow, `${label}: heading level skipped, ${skip}`);
  if (s.unnamed.length) issue(flow, `${label}: controls without a name: ${s.unnamed.join(', ')}`);
  if (s.navs.length > 1 && s.unlabeledNavs) issue(flow, `${label}: ${s.unlabeledNavs} <nav> without a label`);
  if (s.imagesWithoutAlt) issue(flow, `${label}: ${s.imagesWithoutAlt} images without alt`);
  if (s.positiveTabindex) issue(flow, `${label}: ${s.positiveTabindex} elements with a positive tabindex`);
  if (!s.lang) issue(flow, `${label}: <html> without lang`);
  if (s.repeated.length) note(flow, `${label}: the same name on several controls: ${s.repeated.join('; ')}`);
  const main = await page.locator('main').first().ariaSnapshot().catch(() => '');
  const dialog = page.locator('[role="dialog"]').last();
  const dialogTree = (await dialog.count()) ? await dialog.ariaSnapshot().catch(() => '') : '';
  const file = `${flow.name}-${flow.screens.length}-${label.replace(/[^a-z0-9]+/gi, '_')}`;
  fs.writeFileSync(
    path.join(snapDir, `${file}.txt`),
    `# ${label}\n# title: ${s.title}\n# headings: ${s.headings.map((h) => `h${h.level} ${h.text}`).join(' | ')}\n\n${dialogTree ? `## dialog\n${dialogTree}\n\n## main\n` : ''}${main}\n`,
  );
  await page.screenshot({ path: path.join(shotDir, `${file}.png`), caret: 'initial' }).catch(() => {});
  return s;
}

/** A dialog just opened: focus inside, a name, and Tab that cannot leave. */
async function dialogChecks(page, flow, where, { tabs = 40 } = {}) {
  const dialog = page.locator('[role="dialog"]').last();
  const opened = await dialog.waitFor({ timeout: 5_000 }).then(() => true).catch(() => false);
  if (!opened) {
    issue(flow, `${where}: no dialog opened`);
    return false;
  }
  await page.waitForTimeout(400);
  const first = await active(page);
  if (!first.inDialog) issue(flow, `${where}: focus stayed outside the dialog, on ${describeStop(first)}`);
  else note(flow, `${where}: focus landed on ${describeStop(first)}`);
  const named = await dialog.evaluate((d) => Boolean(d.getAttribute('aria-labelledby') || d.getAttribute('aria-label')));
  if (!named) issue(flow, `${where}: dialog without an accessible name`);
  for (let i = 0; i < tabs; i++) {
    await page.keyboard.press('Tab');
    const stop = await active(page);
    if (stop.tag !== 'body' && !stop.inDialog) {
      issue(flow, `${where}: Tab escaped the dialog to ${describeStop(stop)}`);
      break;
    }
    checkStop(flow, stop, `${where} (Tab ${i + 1})`);
  }
  if (tabs && first.key !== 'body') await focusKey(page, first.key);
  return true;
}

/** Escape closes the dialog and focus goes back to what opened it. */
async function escapeReturns(page, flow, where, openerKey) {
  await page.keyboard.press('Escape');
  const closed = await page.locator('[role="dialog"]').last().waitFor({ state: 'detached', timeout: 5_000 }).then(() => true).catch(() => false);
  if (!closed) {
    issue(flow, `${where}: Escape did not close the dialog`);
    return false;
  }
  await page.waitForTimeout(250);
  const after = await active(page);
  if (after.key !== openerKey) issue(flow, `${where}: after Escape, focus went to ${describeStop(after)} instead of back to the opener`);
  else note(flow, `${where}: Escape closed the dialog and focus returned to the opener`);
  return after.key === openerKey;
}

const toast = (page, pattern) =>
  page
    .locator('[role="status"], [role="alert"]', { hasText: pattern })
    .first()
    .waitFor({ timeout: 10_000 })
    .then(() => true)
    .catch(() => false);

async function login(browser) {
  const context = await browser.newContext({ locale: 'he-IL', timezoneId: 'Asia/Jerusalem', viewport: VIEWPORT });
  await context.addInitScript(installHelpers);
  const page = await context.newPage();
  await page.goto(`${baseUrl}/he/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 }),
    page.click('form button[type="submit"]'),
  ]);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await gate(page, context);
  await page.close();
  return context;
}

async function gate(page, context) {
  const banner = await page.locator(`text=${SYNTHETIC_TEXT}`).count();
  if (banner === 0) {
    await context.close();
    throw new Error(
      'Signed in, but this clinic is not marked synthetic (no sandbox banner). Refusing to continue: this walk writes, and must never touch a real practice.',
    );
  }
}

async function open(page, url) {
  await page.goto(url, { waitUntil: 'networkidle' }).catch(() => {});
  await settled(page);
}

/** The page's own loading state is over: no skeleton left in <main>. */
async function settled(page) {
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('main [aria-busy="true"]'), null, { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(500);
}

function finish(flow, context) {
  results.push(flow);
  const mark = flow.ok ? ' ok ' : 'FAIL';
  console.log(`${mark}  ${flow.name}${flow.issues.length ? `\n        ${flow.issues.join('\n        ')}` : ''}`);
  return context.close();
}

/* ---- the flows ----------------------------------------------------------- */

const flows = {
  /** Sign in with the keyboard, find the skip link, walk the shell, open the patients menu entry. */
  async login(browser) {
    const flow = makeFlow('login');
    const context = await browser.newContext({ locale: 'he-IL', timezoneId: 'Asia/Jerusalem', viewport: VIEWPORT });
    await context.addInitScript(installHelpers);
    const page = await context.newPage();
    await open(page, `${baseUrl}/he/login`);
    await screen(page, flow, 'login page');
    const emailField = await tabTo(page, flow, (s) => s.id === 'email', { where: 'login' });
    if (!emailField) return finish(flow, context);
    await page.keyboard.insertText(email);
    const passwordField = await tabTo(page, flow, (s) => s.id === 'password', { where: 'login' });
    if (!passwordField) return finish(flow, context);
    await page.keyboard.insertText(password);
    await Promise.all([
      page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 }).catch(() => null),
      page.keyboard.press('Enter'),
    ]);
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    if (page.url().includes('/login')) {
      issue(flow, 'login: Enter in the password field did not sign in');
      return finish(flow, context);
    }
    await gate(page, context);
    note(flow, 'login: Enter in the password field signed in');
    await page.waitForTimeout(700);
    await screen(page, flow, 'home');

    // The skip link is the first stop, and it works.
    await page.keyboard.press('Tab');
    const first = await active(page);
    checkStop(flow, first, 'home, first Tab');
    if (!/דילוג/.test(first.name)) issue(flow, `home: the first Tab stop is ${describeStop(first)}, not the skip link`);
    else {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);
      const target = await active(page);
      if (target.id !== 'main-content') issue(flow, `home: the skip link moved focus to ${describeStop(target)} instead of the main content`);
      else note(flow, 'home: the skip link moves focus to the main content');
    }

    // The whole order of the shell — header, sidebar, main — from the top.
    await open(page, `${baseUrl}/he`);
    const stops = await tabWalk(page, flow, { where: 'home walk' });
    note(flow, `home: ${stops.length} Tab stops — ${stops.map((s) => `${s.role}:${s.name.slice(0, 16) || '?'}`).join(' › ')}`);

    // The main menu, opened with Enter.
    await open(page, `${baseUrl}/he`);
    const patients = await tabTo(page, flow, (s) => s.role === 'link' && /^מטופלים$/.test(s.name), { where: 'home → patients menu entry' });
    if (patients) {
      await Promise.all([page.waitForURL(/\/patients/, { timeout: 15_000 }).catch(() => null), page.keyboard.press('Enter')]);
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
      if (!/\/patients/.test(page.url())) issue(flow, 'home → patients: Enter on the menu entry did not open the patients list');
      else {
        await page.waitForTimeout(500);
        note(flow, `patients: after the navigation focus is on ${describeStop(await active(page))}`);
      }
    }
    return finish(flow, context);
  },

  /** Find the standing test patient, arrow through the tabs, edit and save — with a validation error on the way. */
  async patient(browser) {
    const flow = makeFlow('patient');
    const context = await login(browser);
    const page = await context.newPage();
    await open(page, `${baseUrl}/he/patients?q=${encodeURIComponent(TEST_PATIENT)}&inactive=1`);
    await screen(page, flow, 'patients list');
    await tabTo(page, flow, (s) => s.role === 'searchbox' || (s.tag === 'input' && /חיפוש/.test(s.name)), { where: 'patients → search box' });
    const link = await tabTo(page, flow, (s) => s.role === 'link' && s.name.includes(TEST_PATIENT), { where: 'patients → the patient link', max: 60 });
    if (link) {
      await Promise.all([page.waitForURL(/\/patients\/[0-9a-f-]{36}$/, { timeout: 15_000 }).catch(() => null), page.keyboard.press('Enter')]);
      if (!/\/patients\/[0-9a-f-]{36}$/.test(page.url())) {
        issue(flow, 'patients: Enter on the patient link did not open the file');
        return finish(flow, context);
      }
    } else {
      // No standing test patient yet: make one, keyboard only.
      await open(page, `${baseUrl}/he/patients/new`);
      await screen(page, flow, 'new patient');
      if (!(await tabTo(page, flow, (s) => s.id === 'first_name', { where: 'new patient' }))) return finish(flow, context);
      await page.keyboard.insertText('בדיקה');
      if (!(await tabTo(page, flow, (s) => s.id === 'last_name', { where: 'new patient' }))) return finish(flow, context);
      await page.keyboard.insertText('אוטומטית');
      if (!(await tabTo(page, flow, (s) => s.id === 'phone', { where: 'new patient' }))) return finish(flow, context);
      await page.keyboard.insertText('050-0000099');
      if (!(await tabTo(page, flow, (s) => s.role === 'button' && /^שמירה/.test(s.name), { where: 'new patient → save', max: 120 }))) {
        return finish(flow, context);
      }
      await Promise.all([page.waitForURL(/\/patients\/[0-9a-f-]{36}$/, { timeout: 15_000 }).catch(() => null), page.keyboard.press('Enter')]);
      if (!/\/patients\/[0-9a-f-]{36}$/.test(page.url())) {
        issue(flow, 'new patient: Enter on save did not create the patient');
        return finish(flow, context);
      }
    }
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(500);
    await screen(page, flow, 'patient file');

    // The tabs answer to the arrows (RTL: the next tab is to the left).
    const tab = await tabTo(page, flow, (s) => s.role === 'tab', { where: 'patient file → tabs', max: 80 });
    if (tab) {
      const selected = () => page.evaluate(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() ?? '');
      const before = await selected();
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(500);
      const after = await selected();
      const onTab = (await active(page)).role === 'tab';
      if (after === before || !onTab) {
        issue(flow, `patient file: ArrowLeft on the tabs did not move to the next tab (focus ${onTab ? 'on a tab' : 'left the tabs'}, selected "${after}")`);
      } else note(flow, `patient file: ArrowLeft moved the tabs from "${before}" to "${after}"`);
    }

    // Edit: the link, then the form.
    await open(page, page.url());
    const edit = await tabTo(page, flow, (s) => s.role === 'link' && /^עריכה/.test(s.name), { where: 'patient file → edit link', max: 80 });
    if (!edit) return finish(flow, context);
    await Promise.all([page.waitForURL(/\/edit$/, { timeout: 15_000 }).catch(() => null), page.keyboard.press('Enter')]);
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(500);
    await screen(page, flow, 'edit patient');

    // A required field emptied: the error must be announced and tied to the field.
    const firstName = await tabTo(page, flow, (s) => s.id === 'first_name', { where: 'edit patient → first name' });
    if (!firstName) return finish(flow, context);
    const original = firstName.value ?? '';
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    const save = await tabTo(page, flow, (s) => s.role === 'button' && /^שמירה/.test(s.name), { where: 'edit patient → save', max: 150 });
    if (!save) return finish(flow, context);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);
    const invalid = await page.evaluate(() => {
      const field = document.getElementById('first_name');
      const described = (field?.getAttribute('aria-describedby') || '')
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => document.getElementById(id))
        .filter(Boolean);
      return {
        ariaInvalid: field?.getAttribute('aria-invalid'),
        announced: described.some((n) => n.getAttribute('role') === 'alert' || n.getAttribute('aria-live')),
        text: described.map((n) => n.textContent?.trim()).join(' | '),
        focused: window.__a11y.describe(document.activeElement),
      };
    });
    if (invalid.ariaInvalid !== 'true') issue(flow, 'edit patient: an emptied required field is not marked aria-invalid after submit');
    if (!invalid.announced) issue(flow, 'edit patient: the validation error is not tied to the field as an announced (role=alert) message');
    else note(flow, `edit patient: the error is announced and tied to the field — "${invalid.text}"`);
    if (!/first_name/.test(invalid.focused)) {
      issue(flow, `edit patient: after a failed submit focus stayed on ${invalid.focused} instead of moving to the first invalid field`);
    } else note(flow, 'edit patient: after a failed submit focus moved to the invalid field');

    // Put the name back, change the occupation, save with Enter on the button.
    await focusKey(page, firstName.key);
    await page.keyboard.press('Control+A');
    await page.keyboard.insertText(original || 'בדיקה');
    const occupation = await tabTo(page, flow, (s) => s.id === 'occupation', { where: 'edit patient → occupation', max: 60 });
    if (!occupation) return finish(flow, context);
    await page.keyboard.press('Control+A');
    await page.keyboard.insertText(`keyboard ${new Date().toISOString().slice(0, 16)}`);
    const save2 = await tabTo(page, flow, (s) => s.role === 'button' && /^שמירה/.test(s.name), { where: 'edit patient → save again', max: 150 });
    if (!save2) return finish(flow, context);
    await page.keyboard.press('Enter');
    if (!(await toast(page, /נשמר/))) issue(flow, 'edit patient: no "saved" message after Enter on save');
    else note(flow, 'edit patient: saved with Enter, and the toast is a live region');
    return finish(flow, context);
  },

  /** Book tomorrow 10:00 through the dialog, then open the block and delete it — all by keyboard. */
  async appointment(browser) {
    const flow = makeFlow('appointment');
    const context = await login(browser);
    const page = await context.newPage();
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const dayUrl = `${baseUrl}/he/calendar?view=day&date=${tomorrow}`;
    await open(page, dayUrl);
    await screen(page, flow, 'calendar day');

    // Booked at 08:00 and moved to 08:30: the day view starts at 07:00, and
    // the sandbox's seeded diary begins at 10:00 in every room, so the move
    // never lands on a taken hour — at 10:00 it did, and the room's refusal
    // ("החדר הזה כבר תפוס") read as a keyboard failure.
    const HOUR = '08';
    const AT = `${HOUR}:00`;
    const HALF = `${HOUR}:30`;
    const blockAtTen = () => page.locator('main button.absolute', { hasText: AT }).first();
    // A leftover booking from an earlier run would collide — cleared with the mouse, not judged.
    if ((await blockAtTen().count()) > 0) {
      await deleteBlockByMouse(page, blockAtTen());
      note(flow, `calendar: a leftover ${AT} booking was cleared first (mouse)`);
      await open(page, dayUrl);
    }

    const opener = await tabTo(page, flow, (s) => /תור חדש/.test(s.name), { where: 'calendar → "new appointment"', max: 250 });
    if (!opener) return finish(flow, context);
    await page.keyboard.press('Enter');
    if (!(await dialogChecks(page, flow, 'new appointment dialog'))) return finish(flow, context);
    await screen(page, flow, 'new appointment dialog');
    const returned = await escapeReturns(page, flow, 'new appointment dialog', opener.key);

    // Again, this time all the way to a booking.
    if (!returned) await focusKey(page, opener.key);
    await page.keyboard.press('Enter');
    const dialog = page.locator('[role="dialog"]').last();
    if (!(await dialog.waitFor({ timeout: 5_000 }).then(() => true).catch(() => false))) {
      issue(flow, 'appointment: the dialog did not open a second time');
      return finish(flow, context);
    }
    await page.waitForTimeout(400);
    let field = await active(page);
    if (field.id !== 'patient_id') field = await tabTo(page, flow, (s) => s.id === 'patient_id', { where: 'appointment dialog → patient', max: 20 });
    if (!field) return finish(flow, context);
    await page.keyboard.insertText('א');
    await page.waitForTimeout(500);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(250);
    const list = await page.evaluate(() => {
      const input = document.getElementById('patient_id');
      const controls = input?.getAttribute('aria-controls');
      const listbox = controls ? document.getElementById(controls) : null;
      const highlighted = listbox?.querySelector('[role="option"][aria-selected="true"]');
      return {
        expanded: input?.getAttribute('aria-expanded'),
        options: listbox?.querySelectorAll('[role="option"]').length ?? 0,
        highlighted: highlighted?.textContent?.trim() ?? '',
        highlightedId: highlighted?.id ?? '',
        activeDescendant: input?.getAttribute('aria-activedescendant') ?? '',
      };
    });
    if (list.expanded !== 'true' || !list.options) issue(flow, 'appointment dialog: typing and ArrowDown did not open the patient list');
    if (!list.highlighted) issue(flow, 'appointment dialog: ArrowDown highlighted no patient');
    if (!list.activeDescendant || list.activeDescendant !== list.highlightedId) {
      issue(
        flow,
        'appointment dialog: the highlighted patient is not exposed through aria-activedescendant — a screen reader hears nothing while arrowing through the list',
      );
    }
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const chosen = await page.evaluate(() => document.getElementById('patient_id')?.value ?? '');
    if (!chosen) {
      issue(flow, 'appointment dialog: Enter did not take the highlighted patient');
      return finish(flow, context);
    }
    note(flow, `appointment dialog: chose "${chosen}" with ArrowDown and Enter`);

    // The date, typed; the hour and the minute, typed into the two lists.
    const date = await tabTo(page, flow, (s) => s.id === 'start_at', { where: 'appointment dialog → date', max: 10 });
    if (!date) return finish(flow, context);
    const [year, month, day] = tomorrow.split('-');
    await page.keyboard.press('Control+A');
    await page.keyboard.insertText(`${day}/${month}/${year}`);
    const hour = await tabTo(page, flow, (s) => s.tag === 'select' && /התחלה/.test(s.name), { where: 'appointment dialog → hour', max: 10 });
    if (!hour) return finish(flow, context);
    await page.keyboard.type(HOUR);
    const minute = await tabTo(page, flow, (s) => s.tag === 'select' && /התחלה/.test(s.name), { where: 'appointment dialog → minute', max: 5 });
    if (minute) await page.keyboard.type('0');
    const time = await page.evaluate(() => [...document.querySelectorAll('[role="group"][aria-label="התחלה"] select')].map((s) => s.value));
    if (time[0] !== HOUR || time[1] !== '00') {
      note(flow, `appointment dialog: typing into the time lists gave ${time.join(':')} — set to ${AT} by the harness`);
      await dialog.locator('[role="group"][aria-label="התחלה"] select').nth(0).selectOption(HOUR);
      await dialog.locator('[role="group"][aria-label="התחלה"] select').nth(1).selectOption('00');
    } else note(flow, 'appointment dialog: typed 10 and 00 into the hour and minute lists');
    const submit = await tabTo(page, flow, (s) => s.tag === 'button' && s.inDialog && /שמירה|קביע/.test(s.name), {
      where: 'appointment dialog → save',
      max: 40,
    });
    if (!submit) return finish(flow, context);
    await page.keyboard.press('Enter');
    if (!(await toast(page, /התור נקבע/))) {
      issue(flow, `appointment dialog: Enter on save did not book (dialogs open: ${await page.locator('[role="dialog"]').count()})`);
      return finish(flow, context);
    }
    note(flow, 'appointment: booked tomorrow ' + AT + ' with the keyboard alone');
    await page.waitForTimeout(500);
    const afterSave = await active(page);
    if (afterSave.tag === 'body') issue(flow, 'appointment: after the dialog closed on save, focus was dropped to the page body');
    else note(flow, `appointment: after saving, focus is on ${describeStop(afterSave)}`);

    // The block on the day: reached by Tab, opened with Enter, deleted through the confirmation.
    if (!(await blockAtTen().waitFor({ timeout: 15_000 }).then(() => true).catch(() => false))) {
      issue(flow, 'appointment: booked, but the block is not drawn on the day within 15 s');
      return finish(flow, context);
    }
    await open(page, dayUrl);
    const block = await tabTo(page, flow, (s) => s.role === 'button' && s.name.includes(AT), { where: 'calendar → the booked block', max: 300 });
    if (!block) {
      note(flow, 'cleanup: the block was deleted with the mouse');
      await deleteBlockByMouse(page, blockAtTen());
      return finish(flow, context);
    }
    // Moved by keyboard: Space lifts the block, two arrows are half an hour,
    // Space drops it; the diary announces the move. Then back up, so the
    // rest of the flow finds its 10:00 where it expects it.
    // At a hand's pace: a key every so often, as a person presses them.
    const pressSlowly = async (...keys) => {
      for (const key of keys) {
        await page.keyboard.press(key);
        await page.waitForTimeout(150);
      }
    };
    await pressSlowly('Space', 'ArrowDown', 'ArrowDown', 'Space');
    if (!(await toast(page, /התור הוזז/))) issue(flow, 'appointment: Space, two arrows and Space did not move the block (no "moved" toast)');
    else {
      note(flow, 'appointment: moved half an hour down with Space, the arrows and Space');
      const halfPast = page.locator('main button.absolute', { hasText: HALF }).first();
      if (!(await halfPast.waitFor({ timeout: 15_000 }).then(() => true).catch(() => false))) issue(flow, 'appointment: the block did not redraw at ' + HALF);
      await page.waitForTimeout(400);
      const after = await active(page);
      if (!(after.role === 'button' && after.name.includes(HALF))) {
        issue(flow, `appointment: after the drop, focus is on ${describeStop(after)} rather than the moved block`);
        if (!(await tabTo(page, flow, (s) => s.role === 'button' && s.name.includes(HALF), { where: 'calendar → the moved block', max: 300 }))) return finish(flow, context);
      }
      await pressSlowly('Space', 'ArrowUp', 'ArrowUp', 'Space');
      if (!(await toast(page, /התור הוזז/))) issue(flow, 'appointment: the move back up gave no "moved" toast');
      if (!(await blockAtTen().waitFor({ timeout: 15_000 }).then(() => true).catch(() => false))) {
        issue(flow, 'appointment: the block did not return to ' + AT);
        return finish(flow, context);
      }
      await page.waitForTimeout(400);
      const back = await active(page);
      if (!(back.role === 'button' && back.name.includes(AT))) {
        if (!(await tabTo(page, flow, (s) => s.role === 'button' && s.name.includes(AT), { where: 'calendar → the block, back at ' + AT, max: 300 }))) return finish(flow, context);
      }
    }
    await page.keyboard.press('Enter');
    // The block opens its details first; the edit form is a button in there.
    if (!(await dialogChecks(page, flow, 'appointment details', { tabs: 12 }))) return finish(flow, context);
    await screen(page, flow, 'appointment details');
    const editButton = await tabTo(page, flow, (s) => s.tag === 'button' && s.inDialog && /עריכת התור/.test(s.name), { where: 'details → edit', max: 12 });
    if (!editButton) return finish(flow, context);
    await page.keyboard.press('Enter');
    if (!(await page.locator('[role="dialog"] #patient_id').waitFor({ timeout: 5_000 }).then(() => true).catch(() => false))) {
      issue(flow, 'details → edit: Enter on "edit" did not open the edit form');
      return finish(flow, context);
    }
    await page.waitForTimeout(400);
    await screen(page, flow, 'edit appointment dialog');
    const del = await tabTo(page, flow, (s) => s.tag === 'button' && s.inDialog && /^מחיקה$/.test(s.name), { where: 'edit dialog → delete', max: 40 });
    if (!del) {
      await page.keyboard.press('Escape');
      await deleteBlockByMouse(page, blockAtTen());
      return finish(flow, context);
    }
    await page.keyboard.press('Enter');
    const confirm = page.locator('[role="dialog"]').last();
    await page.waitForTimeout(400);
    const confirmFocus = await active(page);
    note(flow, `confirm dialog: focus landed on ${describeStop(confirmFocus)}`);
    await screen(page, flow, 'confirm delete');
    const confirmButton =
      /^מחיקה$/.test(confirmFocus.name) && confirmFocus.tag === 'button'
        ? confirmFocus
        : await tabTo(page, flow, (s) => s.tag === 'button' && /^מחיקה$/.test(s.name), { where: 'confirm → delete', max: 6 });
    if (!confirmButton) return finish(flow, context);
    await page.keyboard.press('Enter');
    if (!(await toast(page, /התור נמחק/))) issue(flow, 'confirm: Enter on delete did not delete (no toast)');
    else note(flow, 'appointment: deleted through the confirmation with the keyboard');
    await confirm.waitFor({ state: 'detached', timeout: 5_000 }).catch(() => {});
    return finish(flow, context);
  },

  /** Open a treatment for the test patient and save a complaint. */
  async treatment(browser) {
    const flow = makeFlow('treatment');
    const context = await login(browser);
    const page = await context.newPage();
    await open(page, `${baseUrl}/he/encounters/new`);
    await screen(page, flow, 'new treatment');
    const combo = await tabTo(page, flow, (s) => s.role === 'combobox', { where: 'new treatment → patient', max: 60 });
    if (!combo) return finish(flow, context);
    await page.keyboard.insertText(TEST_PATIENT);
    // The list is searched on the server: wait for the match to be there and
    // highlighted (typing highlights the first match; ArrowDown would move on
    // to the second) rather than take whatever the stale list had at index 1.
    const match = page.locator('[role="option"][aria-selected="true"]', { hasText: TEST_PATIENT });
    if (!(await match.waitFor({ timeout: 8_000 }).then(() => true).catch(() => false))) {
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(300);
    }
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const chosen = (await active(page)).value ?? '';
    if (!chosen.includes('בדיקה')) {
      issue(flow, `new treatment: the patient was not chosen by keyboard (field shows "${chosen}")`);
      return finish(flow, context);
    }
    const openButton = await tabTo(page, flow, (s) => s.tag === 'button' && /פתיחת טיפול/.test(s.name), { where: 'new treatment → open', max: 20 });
    if (!openButton) return finish(flow, context);
    await Promise.all([page.waitForURL(/\/encounters\/[0-9a-f-]{36}$/, { timeout: 20_000 }).catch(() => null), page.keyboard.press('Enter')]);
    if (!/\/encounters\/[0-9a-f-]{36}$/.test(page.url())) {
      issue(flow, 'new treatment: Enter did not open a treatment');
      return finish(flow, context);
    }
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(700);
    await screen(page, flow, 'treatment');
    const complaint = await tabTo(page, flow, (s) => s.id === 'chief_complaint', { where: 'treatment → chief complaint', max: 150 });
    if (!complaint) return finish(flow, context);
    await page.keyboard.insertText(`תלונה במקלדת ${new Date().toISOString().slice(11, 16)}`);
    const save = await tabTo(page, flow, (s) => s.tag === 'button' && /^שמירה$/.test(s.name), { where: 'treatment → save', max: 250 });
    if (!save) return finish(flow, context);
    await page.keyboard.press('Enter');
    if (!(await toast(page, /הטיפול נשמר/))) issue(flow, 'treatment: no "saved" message after Enter on save');
    else note(flow, 'treatment: saved with the keyboard');
    return finish(flow, context);
  },

  /** Quick-add a task on the home page, tick it, untick it, delete it. */
  async tasks(browser) {
    const flow = makeFlow('tasks');
    const context = await login(browser);
    const page = await context.newPage();
    await open(page, `${baseUrl}/he`);
    const input = await tabTo(page, flow, (s) => /משימה חדשה|מה צריך לעשות/.test(s.name), { where: 'home → quick task field', max: 200 });
    if (!input) return finish(flow, context);
    const title = `משימה במקלדת ${Date.now()}`;
    await page.keyboard.insertText(title);
    await page.keyboard.press('Enter');
    const row = page.locator('main li', { hasText: title }).first();
    if (!(await row.waitFor({ timeout: 10_000 }).then(() => true).catch(() => false))) {
      issue(flow, 'tasks: Enter in the quick field did not add the task');
      return finish(flow, context);
    }
    note(flow, 'tasks: Enter added the task');
    await page.waitForTimeout(400);
    note(flow, `tasks: after adding, focus is on ${describeStop(await active(page))}`);
    await screen(page, flow, 'home with the new task');
    const boxKey = await row
      .locator('input[type="checkbox"]')
      .first()
      .evaluate((el) => window.__a11y.key(el))
      .catch(() => null);
    if (!boxKey) {
      issue(flow, 'tasks: the new row has no checkbox');
      return finish(flow, context);
    }
    const box = await tabTo(page, flow, (s) => s.key === boxKey, { where: 'task row → checkbox', max: 120 });
    if (!box) return finish(flow, context);
    await page.keyboard.press('Space');
    await page.waitForTimeout(800);
    // The widget shows open tasks only: a ticked row leaves the list at once.
    const removed = await row.waitFor({ state: 'detached', timeout: 3_000 }).then(() => true).catch(() => false);
    const afterTick = await active(page);
    if (removed) {
      note(flow, 'tasks: Space ticked the task and the row left the list');
      if (afterTick.tag === 'body') issue(flow, 'tasks: after ticking, focus was dropped to the page body');
      else note(flow, `tasks: after ticking, focus moved to ${describeStop(afterTick)}`);
      // Cleanup, with the mouse: the done task is deleted from the tasks page.
      await open(page, `${baseUrl}/he/tasks`);
      // Done tasks sit in a closed section on the tasks page.
      await page.locator('main button[aria-expanded="false"]', { hasText: /·s*d+$/ }).first().click().catch(() => {});
      await page.waitForTimeout(300);
      const doneRow = page.locator('main li', { hasText: title }).first();
      if ((await doneRow.count()) > 0) {
        await doneRow.locator('button[aria-label*="מחיקת המשימה"], button[aria-label="מחיקה"]').first().click({ timeout: 5_000 }).catch(() => {});
        await page.locator('[role="dialog"] button', { hasText: /^מחיקה$/ }).last().click().catch(() => {});
        await doneRow.waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {});
      }
      return finish(flow, context);
    }
    const ticked = await page.evaluate((k) => document.querySelector(`[data-a11y-key="${k}"]`)?.checked, boxKey);
    if (!ticked) issue(flow, 'tasks: Space did not tick the checkbox');
    else note(flow, 'tasks: Space ticked the task');
    if (afterTick.key !== boxKey) issue(flow, `tasks: after ticking, focus jumped to ${describeStop(afterTick)}`);
    await page.keyboard.press('Space');
    await page.waitForTimeout(600);
    const delKey = await row
      .locator('button[aria-label*="מחיקה"]')
      .first()
      .evaluate((el) => window.__a11y.key(el))
      .catch(() => null);
    if (!delKey) {
      issue(flow, 'tasks: the row has no delete button');
      return finish(flow, context);
    }
    const del = await tabTo(page, flow, (s) => s.key === delKey, { where: 'task row → delete', max: 20 });
    if (!del) return finish(flow, context);
    await page.keyboard.press('Enter');
    const gone = await row.waitFor({ state: 'detached', timeout: 10_000 }).then(() => true).catch(() => false);
    if (!gone) issue(flow, 'tasks: Enter on delete did not remove the task');
    else note(flow, 'tasks: Enter deleted the task');
    await page.waitForTimeout(300);
    const afterDelete = await active(page);
    if (afterDelete.tag === 'body') issue(flow, 'tasks: after deleting a task, focus was dropped to the page body');
    else note(flow, `tasks: after deleting, focus is on ${describeStop(afterDelete)}`);
    return finish(flow, context);
  },
};

/** Cleanup only: opens a block with the mouse and deletes it through the confirmation. */
async function deleteBlockByMouse(page, block) {
  await block.click();
  const details = page.locator('[role="dialog"]').first();
  await details.waitFor({ timeout: 5_000 });
  // A block opens its details first; the delete button is on the edit form
  // behind "edit". Without this step a leftover booking stayed forever and
  // every later run failed on it.
  const editButton = details.locator('button', { hasText: /עריכת התור/ }).first();
  if ((await editButton.count()) > 0) {
    await editButton.click();
    await page.locator('[role="dialog"] button', { hasText: /^מחיקה$/ }).first().waitFor({ timeout: 5_000 });
  }
  const edit = page.locator('[role="dialog"]').first();
  await edit.locator('button', { hasText: /^מחיקה$/ }).first().click();
  await page.locator('[role="dialog"]').last().locator('button', { hasText: /^מחיקה$/ }).last().click();
  await toast(page, /התור נמחק/);
  await page.waitForTimeout(500);
}

/* ---- main ---------------------------------------------------------------- */

async function main() {
  if (!email || !password) throw new Error('SMOKE_EMAIL and SMOKE_PASSWORD are not set (apps/web/.env.test.local).');
  await waitForServer();
  const browser = await chromium.launch({
    channel: process.env.PW_CHANNEL ?? 'msedge',
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    for (const [name, run] of Object.entries(flows)) {
      if (only && !only.includes(name)) continue;
      try {
        await run(browser);
      } catch (error) {
        const flow = currentFlow?.name === name && !results.includes(currentFlow) ? currentFlow : makeFlow(name);
        issue(flow, `harness: ${String(error?.message ?? error).slice(0, 300)}`);
        results.push(flow);
        console.log(`FAIL  ${name}\n        ${flow.issues[0]}`);
      }
    }
  } finally {
    await browser.close();
  }

  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(results, null, 2));
  const lines = ['# Keyboard and screen-reader walk', '', `Server: ${baseUrl}`, ''];
  for (const flow of results) {
    lines.push(`## ${flow.ok ? '✅' : '❌'} ${flow.name}`, '');
    if (flow.issues.length) lines.push('**Issues**', '', ...flow.issues.map((i) => `- ${i}`), '');
    if (flow.notes.length) lines.push('**Notes**', '', ...flow.notes.map((n) => `- ${n}`), '');
  }
  lines.push('', `Trees: ${path.relative(root, snapDir)}`, `Screenshots: ${path.relative(root, shotDir)}`);
  fs.writeFileSync(path.join(outDir, 'summary.md'), lines.join('\n') + '\n');
  const failed = results.filter((f) => !f.ok).length;
  console.log(`\n${results.length} flows, ${failed} with problems → ${path.relative(root, outDir)}`);
  process.exitCode = failed ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
