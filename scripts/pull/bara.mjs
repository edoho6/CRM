#!/usr/bin/env node
// Walk the three professional indexes of barapro.co.il — classic formulas,
// medicinal herbs, lab tests — with the session that login.mjs kept, and
// save every entry: its page as it was served, and a parsed record.
//
//   node scripts/pull/login.mjs --site=bara --url=https://barapro.co.il/   (once)
//   node scripts/pull/bara.mjs                       # all three indexes
//   node scripts/pull/bara.mjs --index=formulas      # one of formulas, herbs, labs
//   node scripts/pull/bara.mjs --limit=3             # a trial: 3 entries per index
//
//   --delay=<ms>  pause between pages (default 600 — one reader turning pages, not a flood)
//   --fresh       fetch again what an earlier run already saved
//
// Output: test-results/pull/bara/index/<index>/entries.json (the records),
// pages/<slug>.html (the pages), and report.txt. Git-ignored; the site says its
// content is theirs, so this is for reading on this computer — moving text
// into the app is a separate decision (see README.md).
//
// The site renders each index one letter at a time and, for herbs, in three
// name modes (pinyin, botanical, Hebrew) that list different sets — Western
// herbs and tinctures appear only under their botanical name. So every letter
// of every mode is read, entries are deduplicated by their path, and the
// records that turn out to be one herb under two names are listed in
// report.txt by title.
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, parseArgs, sleep, writeJson } from './lib/common.mjs';
import { hasProfile, openProfile, restoreCookies } from './lib/browser.mjs';

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(`usage: node scripts/pull/bara.mjs [--index=formulas,herbs,labs] [--limit=<n>] [--delay=<ms>] [--fresh]

Needs a session first: node scripts/pull/login.mjs --site=bara --url=https://barapro.co.il/
Writes test-results/pull/bara/index/<index>/{entries.json,pages/,report.txt}`);
  process.exit(0);
}

const SITE = 'bara';
const ORIGIN = 'https://barapro.co.il';
const LOCKED = 'נגיש למשתמשים רשומים בלבד';
const INDEXES = {
  formulas: { root: '/indexes/formulas/', modes: [null] },
  herbs: {
    root: '/indexes/אינדקס-צמחי-מרפא/',
    modes: ['pinYanName', 'botanicalName', 'hebrewName'],
  },
  labs: { root: '/indexes/lab-tests/', modes: [null] },
};

const wanted =
  args.index && args.index !== 'all'
    ? String(args.index)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : Object.keys(INDEXES);
for (const name of wanted) {
  if (!INDEXES[name]) {
    console.log(`unknown index "${name}" — known: ${Object.keys(INDEXES).join(', ')}`);
    process.exit(1);
  }
}
const limit = args.limit ? Math.max(1, Number(args.limit)) : Infinity;
const delay = Math.max(0, Number(args.delay ?? 600));
const fresh = Boolean(args.fresh);

if (!hasProfile(SITE)) {
  console.log(
    `no session for "${SITE}" yet — first: node scripts/pull/login.mjs --site=${SITE} --url=${ORIGIN}/`,
  );
  process.exit(1);
}

const OUT = path.join(REPO_ROOT, 'test-results', 'pull', SITE, 'index');
fs.mkdirSync(OUT, { recursive: true });

/** The last path segment, as a file name. */
function slugOf(pathname) {
  const decoded = decodeURIComponent(pathname).replace(/\/+$/, '');
  return (
    decoded
      .slice(decoded.lastIndexOf('/') + 1)
      .replace(/[^\p{L}\p{N}-]+/gu, '-')
      .slice(0, 120) || 'entry'
  );
}

// ---- in the browser -------------------------------------------------------

/** Letter pages of one index (and mode), from the letter bar of the page that is open. */
function collectLetterLinks({ root, mode }) {
  const seen = new Set();
  for (const a of document.querySelectorAll('a[href*="key="]')) {
    const url = new URL(a.href);
    if (decodeURIComponent(url.pathname) !== root) continue;
    if (mode && url.searchParams.get('filterByName') !== mode) continue;
    if (!mode && url.searchParams.get('filterByName')) continue;
    seen.add(url.href);
  }
  return [...seen];
}

/** Entry links on a letter page: under the index path, one segment deeper, no letter query. */
function collectEntryLinks({ root }) {
  const entries = new Map();
  for (const a of document.querySelectorAll('a[href]')) {
    const url = new URL(a.href);
    const pathname = decodeURIComponent(url.pathname);
    if (!pathname.startsWith(root) || pathname === root) continue;
    if (url.searchParams.has('key')) continue;
    const rest = pathname.slice(root.length).replace(/\/+$/, '');
    if (!rest || rest.includes('/')) continue;
    const text = (a.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    if (!entries.has(pathname))
      entries.set(pathname, { path: pathname, href: url.href, listName: text });
  }
  return [...entries.values()];
}

/** What the entry page says, by kind of index. Runs inside the page. */
function extractEntry(kind) {
  const clean = (s) =>
    (s ?? '')
      .replace(/ /g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  // "label: value" lines, and a label with nothing after the colon that is
  // followed by lines (bullets) until the next blank line.
  const fieldsOf = (text) => {
    const fields = {};
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = /^([^:：]{2,40}):\s*(.*)$/.exec(lines[i].trim());
      if (!m) continue;
      const label = m[1].trim();
      let value = m[2].trim();
      if (!value) {
        const more = [];
        for (let j = i + 1; j < lines.length && lines[j].trim(); j++) more.push(lines[j].trim());
        value = more.join('\n');
        i += more.length;
      }
      if (value && !(label in fields)) fields[label] = value;
    }
    return fields;
  };

  const locked = (document.body.innerText || '').includes('נגיש למשתמשים רשומים בלבד');
  const h2 = document.querySelector('.banner-text h2');
  const span = h2?.querySelector('span');
  const record = {
    locked,
    title: clean(h2?.textContent),
    hebrew: clean(
      h2
        ? Array.from(h2.childNodes)
            .filter((n) => n.nodeType === 3)
            .map((n) => n.textContent)
            .join(' ')
        : '',
    ),
    latin: clean(span?.textContent),
  };

  // "Albumin | אלבומין | חלבון הדם" and "BA ZHEN TANG | 八珍湯": the names, one per bar.
  record.names = record.title
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);

  if (kind === 'formulas') {
    record.name = clean(document.querySelector('h4.dark-heading')?.textContent) || record.title;
    if (!record.title) {
      record.title = record.name;
      record.names = record.name
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    record.sections = {};
    record.ingredients = [];
    for (const card of document.querySelectorAll('#accordion .card')) {
      const name = clean(card.querySelector('.card-header button')?.textContent);
      const body = card.querySelector('.card-body');
      if (!name || !body) continue;
      const table = body.querySelector('.body-table');
      if (table) {
        for (const row of table.querySelectorAll('.string')) {
          const link = row.querySelector('.row1 a');
          record.ingredients.push({
            name: clean(link?.textContent ?? row.querySelector('.row1')?.textContent),
            href: link?.getAttribute('href') ?? null,
            form: clean(row.querySelector('.row2')?.textContent),
            dose: clean(row.querySelector('.row3')?.textContent),
          });
        }
      } else {
        const text = clean(body.innerText);
        if (text) record.sections[name] = { text, html: body.innerHTML.trim() };
      }
    }
    const shelf = document.querySelector(
      '#accordion .card-body a[href*="/%D7%9E%D7%95%D7%A6%D7%A8%D7%99-%D7%9E%D7%93%D7%A3/"], #accordion .card-body a[href*="/מוצרי-מדף/"]',
    );
    record.shelfProduct = shelf ? new URL(shelf.href).href : null;
    return record;
  }

  if (kind === 'herbs') {
    const item = document.querySelector('.content-item');
    record.image = item?.querySelector('img')?.getAttribute('src') ?? null;
    record.audio = document.querySelector('audio#audio')?.getAttribute('src') ?? null;
    const text = clean(item?.innerText)
      .split('\n')
      .filter((line) => !/הוספת רכיב לפורמולה/.test(line))
      .join('\n');
    record.text = text;
    record.fields = fieldsOf(text);
    record.html = item?.innerHTML.trim() ?? '';
    return record;
  }

  const body =
    document.querySelector('.content-page .umb-grid') ?? document.querySelector('.content-page');
  record.text = clean(body?.innerText);
  record.fields = fieldsOf(record.text);
  record.html = body?.innerHTML.trim() ?? '';
  return record;
}

// ---- the walk -------------------------------------------------------------

const context = await openProfile(SITE);
await restoreCookies(context, SITE);
const page = context.pages()[0] ?? (await context.newPage());
page.setDefaultTimeout(45_000);

async function open(url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
}

// The session first: one locked page means every page will be.
await open(`${ORIGIN}/indexes/formulas/`);
if (await page.evaluate((needle) => document.body.innerText.includes(needle), LOCKED)) {
  await context.close();
  console.log(
    `the site shows "${LOCKED}" — the session is gone; run login.mjs --site=${SITE} again`,
  );
  process.exit(1);
}

const report = [];
const say = (line) => {
  console.log(line);
  report.push(line);
};

try {
  for (const kind of wanted) {
    const { root, modes } = INDEXES[kind];
    const dir = path.join(OUT, kind);
    const pagesDir = path.join(dir, 'pages');
    fs.mkdirSync(pagesDir, { recursive: true });
    const entriesFile = path.join(dir, 'entries.json');
    const known = new Map();
    if (!fresh && fs.existsSync(entriesFile)) {
      for (const record of JSON.parse(fs.readFileSync(entriesFile, 'utf8')))
        known.set(record.path, record);
    }

    // 1. Every letter of every mode → the list of entries.
    const list = new Map();
    for (const mode of modes) {
      const modeRoot = `${ORIGIN}${encodeURI(root)}${mode ? `?q=&filterByName=${mode}` : ''}`;
      await open(modeRoot);
      const letters = await page.evaluate(collectLetterLinks, { root, mode });
      const letterPages = [modeRoot, ...letters.filter((href) => href !== modeRoot)];
      for (const href of letterPages) {
        if (href !== modeRoot) {
          await sleep(delay);
          await open(href);
        }
        for (const entry of await page.evaluate(collectEntryLinks, { root })) {
          const existing = list.get(entry.path);
          if (existing) {
            if (mode && !existing.modes.includes(mode)) existing.modes.push(mode);
          } else {
            list.set(entry.path, { ...entry, modes: mode ? [mode] : [] });
          }
        }
      }
      say(
        `${kind}: ${mode ?? 'index'} — ${letterPages.length} letter pages, ${list.size} entries so far`,
      );
    }
    writeJson(dir, 'list.json', [...list.values()]);

    // 2. Every entry.
    const records = [];
    let fetched = 0;
    let skipped = 0;
    let failed = 0;
    const flush = () => writeJson(dir, 'entries.json', records);
    for (const entry of list.values()) {
      if (fetched >= limit) break;
      const had = known.get(entry.path);
      if (had && !had.locked) {
        records.push(had);
        skipped++;
        continue;
      }
      await sleep(delay);
      try {
        await open(entry.href);
        const extracted = await page.evaluate(extractEntry, kind);
        const slug = slugOf(entry.path);
        fs.writeFileSync(path.join(pagesDir, `${slug}.html`), await page.content());
        records.push({
          index: kind,
          path: entry.path,
          url: entry.href,
          listName: entry.listName,
          modes: entry.modes,
          page: `pages/${slug}.html`,
          fetchedAt: new Date().toISOString(),
          ...extracted,
        });
        fetched++;
        if (extracted.locked) say(`  locked: ${entry.path}`);
      } catch (error) {
        failed++;
        say(`  failed: ${entry.path} — ${error.message.split('\n')[0]}`);
      }
      if ((fetched + failed) % 10 === 0) {
        flush();
        console.log(
          `  ${kind}: ${fetched} fetched, ${skipped} kept from before, ${failed} failed, ${list.size - records.length - failed} to go`,
        );
      }
    }
    flush();

    // Which records are one thing under two names.
    const byTitle = new Map();
    for (const record of records) {
      if (!record.title) continue;
      const group = byTitle.get(record.title) ?? [];
      group.push(record.path);
      byTitle.set(record.title, group);
    }
    const twins = [...byTitle.entries()].filter(([, paths]) => paths.length > 1);
    say(
      `${kind}: ${records.length} records (${fetched} fetched now, ${skipped} from an earlier run, ${failed} failed); ${twins.length} titles under more than one address`,
    );
    for (const [title, paths] of twins) report.push(`  ${title}: ${paths.join('  ')}`);
    fs.writeFileSync(path.join(dir, 'report.txt'), `${report.join('\n')}\n`);
  }
} finally {
  await context.close().catch(() => {});
}

fs.writeFileSync(
  path.join(OUT, 'report.txt'),
  `${new Date().toISOString()}\n${report.join('\n')}\n`,
);
console.log(`\nwritten to ${OUT}`);
