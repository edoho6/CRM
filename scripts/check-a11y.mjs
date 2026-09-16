/**
 * Runs axe against the pages a machine can actually reach.
 *
 * The colour half of standard 5568 is already measured by check-contrast.mjs,
 * which reads the emitted stylesheet. This covers the structural half: form
 * fields without labels, controls without accessible names, a missing lang or
 * dir, broken heading order, ARIA that points at nothing.
 *
 * Why jsdom rather than a real browser: every page behind the login is server
 * data, and CI has no database to render it from. What is left is the handful of
 * public pages, and for those the server-rendered HTML is the whole document —
 * so parsing it is enough, and it keeps CI to one `pnpm install` with no browser
 * download. The limits are real and worth stating plainly:
 *
 *   · rules that need layout (target size, reflow) cannot run — jsdom has no
 *     geometry, so axe skips them rather than passing them
 *   · colour contrast is not evaluated here; check-contrast.mjs does that from
 *     the stylesheet, which is the more reliable measurement anyway
 *   · nothing behind the login is covered, and that is most of the application
 *
 * Closing that last gap needs a seeded staging database — the same blocker as
 * §12 of SECURITY.md. Until then this catches the class of mistake that gets
 * introduced by an ordinary edit to a form.
 *
 * Usage:  node scripts/check-a11y.mjs [baseUrl]
 */

import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const axePath = require.resolve('axe-core');
const axeSource = fs.readFileSync(axePath, 'utf8');

const baseUrl = (process.argv[2] || process.env.A11Y_BASE_URL || 'http://localhost:3000').replace(
  /\/$/,
  '',
);

/* The pages that render without a session. Everything else needs a database. */
const ROUTES = [
  // The two a regulator opens first, and the two this list was missing.
  '/he/about',
  '/en/about',
  '/he/accessibility',
  '/en/accessibility',
  '/he/privacy',
  '/he/terms',
  '/he/delete-account',
  '/he/login',
  '/en/login',
  '/he/signup',
  '/en/signup',
  '/he/book/demo-clinic',
  '/en/book/demo-clinic',
  '/he/setup',
  '/en/setup',
];

/* Israeli standard 5568 is WCAG 2.1 AA, which is exactly these tags. */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function auditRoute(route) {
  const url = `${baseUrl}${route}`;
  const response = await fetch(url, { redirect: 'follow' });

  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }

  const html = await response.text();

  // jsdom has no canvas, and axe reaches for one when it tries to sample a
  // colour. Swallowing its "not implemented" chatter keeps the real findings
  // readable; nothing is being hidden, because the contrast rule is switched off
  // below and measured properly elsewhere.
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', () => {});

  // runScripts lets axe execute inside the document; the page's own scripts are
  // not fetched, which is what we want — this is a check of the markup the
  // server sent, not of the hydrated application.
  const dom = new JSDOM(html, {
    url,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole,
  });

  dom.window.eval(axeSource);

  const results = await dom.window.axe.run(dom.window.document, {
    runOnly: { type: 'tag', values: TAGS },
    // Contrast needs pixels. check-contrast.mjs measures it from the stylesheet,
    // which is exact rather than sampled, so leaving it on here would only
    // produce noise and a false sense that it had been checked twice.
    rules: { 'color-contrast': { enabled: false } },
    resultTypes: ['violations'],
  });

  dom.window.close();
  return results.violations;
}

let failures = 0;

console.log(`\naxe · WCAG 2.1 AA · ${baseUrl}\n`);

for (const route of ROUTES) {
  let violations;
  try {
    violations = await auditRoute(route);
  } catch (error) {
    console.error(`  ${route} — could not be audited: ${error.message}`);
    failures++;
    continue;
  }

  if (violations.length === 0) {
    console.log(`  ok  ${route}`);
    continue;
  }

  failures += violations.length;
  console.log(`  FAIL ${route}`);
  for (const violation of violations) {
    console.log(`       ${violation.id} (${violation.impact}) — ${violation.help}`);
    for (const node of violation.nodes.slice(0, 3)) {
      console.log(`         ${node.html.slice(0, 140)}`);
    }
    console.log(`         ${violation.helpUrl}`);
  }
}

console.log('');

if (failures > 0) {
  console.error(`${failures} accessibility problem(s). See the links above.\n`);
  process.exit(1);
}

console.log(`${ROUTES.length} pages checked, no violations.`);
console.log('Pages behind the login are not covered — that needs a seeded staging database.\n');
