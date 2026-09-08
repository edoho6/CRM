#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

/**
 * Catches the silent failure: a class used by a shared component that compiles
 * to no CSS in one of the apps.
 *
 * Tailwind emits a rule for a utility only when the token behind it exists in
 * the theme of the app being built, and `@source` makes it *scan* the shared
 * package without giving it any of that app's tokens. So a component can be
 * imported correctly, typecheck, build without a warning, and render with no
 * colour — which is how every primary button in the patient portal came to be
 * bare text on the page background: `@clinic/ui` paints them `bg-accent`, and
 * only the staff app had ever declared `--color-accent`.
 *
 * Nothing else in the toolchain sees this. TypeScript does not know about CSS,
 * the build does not warn on an unmatched class, and the contrast checker only
 * measures colours that were emitted — a colour that vanished entirely passes it.
 *
 * The test is divergence rather than absence: a class that compiles in one app
 * and not another is a real inconsistency, whereas a class missing from every
 * app is usually this script's own extraction picking up something that was
 * never a class. Both are reported; only the first fails the run.
 *
 *   pnpm build && pnpm check:tokens
 */

const root = path.resolve(import.meta.dirname, '..');
const SHARED = path.join(root, 'packages/ui/src');
const APPS = ['web', 'portal'];

/* Utilities whose rendering depends on a theme token. A missing `flex` would be
   a bug in the package; a missing `bg-accent` is a bug in an app's theme, and
   those are the ones this looks for. */
const COLOR_UTILITY =
  /^-?(?:bg|text|border|ring|outline|fill|stroke|divide|shadow|accent|caret|from|via|to|decoration|placeholder)-/;

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * Candidates are pulled from every string literal, the way Tailwind's own
 * scanner works — class names reach `cn()` as bare arguments and as template
 * pieces, not only in a `className=` attribute, and an extractor that only
 * looked at the attribute missed most of them.
 */
const used = new Map(); // class -> Set of files
for (const file of walk(SHARED)) {
  const source = fs.readFileSync(file, 'utf8');
  const relative = path.relative(root, file).replace(/\\/g, '/');
  for (const match of source.matchAll(/['"`]([^'"`\n]{2,200})['"`]/g)) {
    for (const token of match[1].split(/\s+/)) {
      const candidate = token.trim();
      if (!candidate || !COLOR_UTILITY.test(candidate)) continue;
      // A theme colour always ends in a name or a name/opacity pair.
      if (!/^[-a-z0-9:/[\].%_]+$/i.test(candidate)) continue;
      if (!used.has(candidate)) used.set(candidate, new Set());
      used.get(candidate).add(relative);
    }
  }
}

/** Tailwind escapes `:` `/` `.` `[` `]` and `%` in the selector it emits. */
function selectorFor(candidate) {
  return `.${candidate.replace(/[:/.[\]%]/g, (c) => `\\${c}`)}`;
}

const cssByApp = new Map();
for (const app of APPS) {
  const dir = path.join(root, `apps/${app}/.next/static/chunks`);
  if (!fs.existsSync(dir)) {
    console.error(`No build found for ${app}. Run \`pnpm build\` first.`);
    process.exit(2);
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.css'));
  const css = files.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  if (css.length === 0) {
    console.error(`${app} built no stylesheet.`);
    process.exit(2);
  }
  cssByApp.set(app, css);
}

const diverging = [];
const absentEverywhere = [];

for (const [candidate, files] of [...used].sort()) {
  const selector = selectorFor(candidate);
  const present = APPS.filter((app) => cssByApp.get(app).includes(selector));
  if (present.length === 0) absentEverywhere.push([candidate, files]);
  else if (present.length < APPS.length) {
    diverging.push([candidate, files, APPS.filter((a) => !present.includes(a))]);
  }
}

console.log(`Shared package: ${used.size} theme-dependent classes`);
for (const app of APPS) {
  console.log(`  ${app}: ${(cssByApp.get(app).length / 1024).toFixed(0)} KB of CSS`);
}

if (absentEverywhere.length > 0) {
  console.log(`\nNot emitted in any app (${absentEverywhere.length}) — check these are real:`);
  for (const [candidate, files] of absentEverywhere) {
    console.log(`  ${candidate}  ← ${[...files].join(', ')}`);
  }
}

if (diverging.length > 0) {
  console.log(`\nFAIL — compiled in one app but not another (${diverging.length}):`);
  for (const [candidate, files, missing] of diverging) {
    console.log(`  ${candidate}`);
    console.log(`      missing from: ${missing.join(', ')}`);
    console.log(`      used by:      ${[...files].join(', ')}`);
  }
  console.log(
    '\nAdd the matching `--color-*` token to that app\'s `@theme` in app/globals.css.',
  );
  process.exit(1);
}

console.log('\nPASS — every shared class compiles in every app.');
