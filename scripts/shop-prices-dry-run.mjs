// Reads one shop the way the price job would, without a database.
//
//   node scripts/shop-prices-dry-run.mjs --store=medicinebom
//   node scripts/shop-prices-dry-run.mjs --store=rosamix --pages=1 --save-fixtures
//   node scripts/shop-prices-dry-run.mjs --store=dryang --offline   (replay the saved names, no requests)
//
// Prints what the classifier kept, what it dropped and the unified names it
// made, so the taxonomy and the brand list can be tuned against real names
// before anything is written. `--save-fixtures` keeps the first feed page
// (only the fields the adapter reads — no descriptions, no pictures) and the
// full list of names and categories under __fixtures__, for the tests.
//
// It is as polite as the job: the same fetcher, the same User-Agent, the
// same pause between requests, robots.txt read first. It only knows the four
// shops with a public feed; the page-reading adapters are not run here
// (they wait for the shops' written agreement).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFetcher } from '../supabase/functions/_shared/shop-prices/fetcher.ts';
import { loadRobots } from '../supabase/functions/_shared/shop-prices/robots.ts';
import { ADAPTERS } from '../supabase/functions/_shared/shop-prices/adapters/index.ts';
import { classify } from '../supabase/functions/_shared/shop-prices/classify.ts';
import { toOffers } from '../supabase/functions/_shared/shop-prices/run.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixturesDir = path.join(root, 'supabase/functions/_shared/shop-prices/__fixtures__');
const reportDir = path.join(root, 'test-results/prices');

const STORES = {
  medicinebom: { name: 'מדיסין בום', base_url: 'https://medicinebom.co.il', platform: 'woocommerce', config: {} },
  tevadirect: { name: 'המילניום', base_url: 'https://www.tevadirect.com', platform: 'woocommerce', config: { dims_order: 'length_first' } },
  dryang: { name: 'ד"ר יאנג', base_url: 'https://dryang.co.il', platform: 'woocommerce', config: {} },
  rosamix: { name: 'רוזמיקס', base_url: 'https://www.rosamix.co.il', platform: 'shopify', config: { collections: ['ציוד-למטפלים'] } },
};

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const m = arg.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [arg, true];
  }),
);
const slug = args.store;
if (!slug || !STORES[slug]) {
  console.error(`--store must be one of: ${Object.keys(STORES).join(', ')}`);
  process.exit(2);
}
const maxPages = args.pages === undefined || args.pages === 'all' ? Infinity : Number(args.pages);
const saveFixtures = Boolean(args['save-fixtures']);
const offline = Boolean(args.offline);

const store = {
  id: '00000000-0000-0000-0000-000000000000',
  slug,
  ...STORES[slug],
  status: 'active',
  crawl_delay_ms: 2000,
  bookmark: null,
  refresh_requested_at: null,
  last_started_at: null,
  last_completed_at: null,
  last_success_at: null,
  last_error_at: null,
  consecutive_failures: 0,
};

const contact = process.env.SHOP_PRICES_CONTACT ?? 'edoho6@gmail.com';
const fetcher = createFetcher({
  userAgent: `HerbalistPriceCheck/1.0 (+https://github.com/edoho6; ${contact}) dry-run`,
  minDelayMs: 2000,
});
const log = { info: (m, d) => console.log('   ', m, d ? JSON.stringify(d) : ''), warn: (m, d) => console.warn('!! ', m, d ? JSON.stringify(d) : '') };

const items = [];
let pages = 0;
if (offline) {
  const saved = JSON.parse(fs.readFileSync(path.join(fixturesDir, `${slug}-names.json`), 'utf8'));
  items.push(...saved.map((entry, i) => ({ externalId: String(i), name: entry.name, url: `${store.base_url}/#${i}`, price: 1, currency: 'ILS', sku: null, gtin: null, available: true, categories: entry.categories })));
} else {
  const robots = await loadRobots(fetcher, store.base_url, 'herbalistpricecheck');
  const adapter = ADAPTERS[store.platform];
  for (const p of adapter.paths(store)) console.log(`robots ${robots.allows(p) ? 'allows ' : 'BLOCKS '} ${p}`);
  if (robots.crawlDelayMs) fetcher.setMinDelay(new URL(store.base_url).host, robots.crawlDelayMs);
  const context = { store, fetcher, robots, log };
  let position = null;
  do {
    const page = await adapter.fetchPage(context, position);
    pages += 1;
    items.push(...page.items);
    console.log(`page ${pages}: ${page.items.length} items, next ${page.next ? JSON.stringify(page.next) : 'none'}`);
    position = page.next;
  } while (position && pages < maxPages);
}

const offers = toOffers(items, slug, store.config);
const kept = new Set(offers.map((o) => o.external_id));
const byCategory = {};
for (const offer of offers) byCategory[offer.product.category] = (byCategory[offer.product.category] ?? 0) + 1;
const shopCategories = {};
for (const item of items) for (const c of item.categories) shopCategories[c] = (shopCategories[c] ?? 0) + 1;

const lines = [];
lines.push(`# ${slug} — ${items.length} listings read in ${pages} page(s), ${fetcher.requests} requests; ${offers.length} in scope`);
lines.push('');
lines.push('## in scope by category');
for (const [c, n] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) lines.push(`${String(n).padStart(4)}  ${c}`);
lines.push('');
lines.push("## the shop's own categories (count of listings)");
for (const [c, n] of Object.entries(shopCategories).sort((a, b) => b[1] - a[1])) lines.push(`${String(n).padStart(4)}  ${c}`);
lines.push('');
lines.push('## kept: category | price | fingerprint | unified name | raw name' + (offline ? '   (offline replay: prices are not real)' : ''));
for (const offer of [...offers].sort((a, b) => a.product.category.localeCompare(b.product.category) || a.fingerprint.localeCompare(b.fingerprint))) {
  lines.push(`${offer.product.category} | ${offer.price} | ${offer.fingerprint} | ${offer.product.canonical_name} | ${offer.raw_name}`);
}
lines.push('');
lines.push('## dropped: raw name | shop categories');
for (const item of items) {
  if (kept.has(item.externalId)) continue;
  const why = classify({ name: item.name, categories: item.categories }, slug) === null ? 'out of scope' : 'no price';
  lines.push(`${why} | ${item.name} | ${item.categories.join(' / ')}`);
}
fs.mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, `dryrun-${slug}.txt`);
fs.writeFileSync(reportPath, lines.join('\n') + '\n');
console.log(`\n${items.length} listings, ${offers.length} in scope, report: ${path.relative(root, reportPath)}`);
console.log(Object.entries(byCategory).map(([c, n]) => `${c}=${n}`).join('  '));

if (saveFixtures && !offline) {
  fs.mkdirSync(fixturesDir, { recursive: true });
  const names = items.map((item) => ({ name: item.name, categories: item.categories }));
  fs.writeFileSync(path.join(fixturesDir, `${slug}-names.json`), JSON.stringify(names, null, 1) + '\n');
  console.log(`fixture: ${slug}-names.json (${names.length} names)`);
}
