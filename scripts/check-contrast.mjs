#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

/**
 * Measures every colour pair the app puts text on, against Israeli standard
 * 5568 — which follows WCAG 2.1 level AA: 4.5:1 for normal text, 3:1 for large
 * text and for the boundary of a user interface component.
 *
 * Run after a build: the values are read out of the emitted stylesheet, not out
 * of a table maintained by hand, so what is measured is what the browser will
 * actually paint. A palette designed for meaning — warm herbs red, cooling
 * herbs blue — is no guarantee of legibility, and the first run of this found
 * three real failures including the primary button.
 *
 *   pnpm build && pnpm check:contrast
 */

const root = path.resolve(import.meta.dirname, '..');
const webRoot = path.join(root, 'apps/web');
const cssDir = path.join(webRoot, '.next/static/chunks');

if (!fs.existsSync(cssDir)) {
  console.error('No build found. Run `pnpm build` first.');
  process.exit(2);
}

const cssFiles = fs.readdirSync(cssDir).filter((f) => f.endsWith('.css'));
if (cssFiles.length === 0) {
  console.error('No stylesheet in the build output.');
  process.exit(2);
}
const css = cssFiles.map((f) => fs.readFileSync(path.join(cssDir, f), 'utf8')).join('\n');

/**
 * Tailwind emits a hex fallback beside each wide-gamut value; the hex is what we
 * measure. Names may contain letters, digits and dashes (`jade-700`, but also
 * `accent-fg`), so the pattern is deliberately loose and it is the `#rrggbb`
 * requirement that keeps it from matching non-colour properties.
 */
const COLOR_DECL = /--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?)\b/g;

/** The minifier shortens #ffffff to #fff; both have to measure the same. */
function expandHex(hex) {
  if (hex.length === 4) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return hex;
}

const vars = new Map([['white', '#ffffff']]);
for (const m of css.matchAll(COLOR_DECL)) {
  if (!vars.has(m[1])) vars.set(m[1], expandHex(m[2]));
}

/**
 * The dark palette, read out of the `[data-theme="dark"]` rule.
 *
 * Dark mode is not an inversion of the light values — every step was chosen by
 * hand — so it has to be measured on its own rather than assumed to inherit the
 * light theme's passing marks. Missing block means dark mode is not built, and
 * the dark pass is skipped rather than failing.
 */
function readDarkPalette(source) {
  // The minifier strips the quotes from the attribute value, so all three
  // spellings have to be looked for — the built stylesheet is what is measured,
  // not the source.
  const at = [`[data-theme="dark"]`, `[data-theme='dark']`, `[data-theme=dark]`]
    .map((needle) => source.indexOf(needle))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  if (at === undefined) return null;

  const open = source.indexOf('{', at);
  const close = source.indexOf('}', open);
  if (open < 0 || close < 0) return null;

  const block = source.slice(open + 1, close);
  const dark = new Map(vars);
  let found = 0;
  for (const m of block.matchAll(COLOR_DECL)) {
    dark.set(m[1], expandHex(m[2]));
    found += 1;
  }
  return found > 0 ? dark : null;
}

const darkVars = readDarkPalette(css);

const toLinear = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex) =>
  0.2126 * toLinear(parseInt(hex.slice(1, 3), 16)) +
  0.7152 * toLinear(parseInt(hex.slice(3, 5), 16)) +
  0.0722 * toLinear(parseInt(hex.slice(5, 7), 16));

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/* Every chip pair, read straight out of the palette source. */
const paletteSource = fs.readFileSync(path.join(webRoot, 'lib/tcm-colors.ts'), 'utf8');
const chipPairs = [...paletteSource.matchAll(/style\('bg-([a-z]+-\d+) text-([a-z]+-\d+)/g)].map((m) => ({
  bg: m[1],
  fg: m[2],
}));

/* The pairs written directly into components, which the source cannot infer. */
const componentPairs = [
  { bg: 'white', fg: 'ink-500', where: 'secondary text' },
  { bg: 'white', fg: 'ink-600', where: 'label text' },
  { bg: 'white', fg: 'ink-700', where: 'body text' },
  { bg: 'white', fg: 'ink-900', where: 'headings' },
  { bg: 'white', fg: 'jade-800', where: 'links' },
  { bg: 'white', fg: 'red-600', where: 'error text' },
  { bg: 'white', fg: 'red-700', where: 'error text' },
  { bg: 'white', fg: 'amber-700', where: 'warning text' },
  { bg: 'ink-50', fg: 'ink-500', where: 'muted badge' },
  { bg: 'ink-50', fg: 'ink-600', where: 'table header' },
  { bg: 'ink-100', fg: 'ink-700', where: 'neutral badge' },
  { bg: 'jade-100', fg: 'jade-800', where: 'success badge' },
  { bg: 'amber-100', fg: 'amber-800', where: 'warning badge' },
  { bg: 'red-100', fg: 'red-700', where: 'danger badge' },
  { bg: 'sky-100', fg: 'sky-800', where: 'info badge' },
  { bg: 'accent', fg: 'accent-fg', where: 'primary button, active nav' },
  { bg: 'accent-strong', fg: 'accent-fg', where: 'primary button, pressed' },
  { bg: 'danger', fg: 'accent-fg', where: 'danger button' },
  { bg: 'danger-strong', fg: 'accent-fg', where: 'danger button, pressed' },
  { bg: 'amber-50', fg: 'amber-900', where: 'review notice' },
  { bg: 'sky-50', fg: 'sky-900', where: 'information notice' },
  { bg: 'amber-200', fg: 'amber-950', where: 'synthetic-data banner' },
  { bg: 'jade-50', fg: 'jade-800', where: 'highlighted option row' },
  { bg: 'white', fg: 'jade-700', where: 'figures and quantities' },
];

const AA_SMALL = 4.5;
let failures = 0;

function measure(pairs, title, palette, seen) {
  console.log(`\n${title}`);
  let checked = 0;
  for (const { bg, fg, where } of pairs) {
    const key = `${bg}|${fg}`;
    if (seen.has(key)) continue;
    seen.add(key);
    checked += 1;

    const bgHex = palette.get(bg);
    const fgHex = palette.get(fg);
    if (!bgHex || !fgHex) {
      console.log(`  ????  ${fg} on ${bg} — not in the stylesheet`);
      failures += 1;
      continue;
    }
    const ratio = contrast(bgHex, fgHex);
    const ok = ratio >= AA_SMALL;
    if (!ok) failures += 1;
    if (!ok || process.env.VERBOSE) {
      console.log(
        `  ${ok ? 'pass' : 'FAIL'}  ${ratio.toFixed(2).padStart(5)}:1  ` +
          `${fg.padEnd(12)} on ${bg.padEnd(12)}${where ? `  (${where})` : ''}`,
      );
    }
  }
  console.log(`  ${checked} pairs checked`);
}

const lightSeen = new Set();
measure(chipPairs, `Light · materia medica chips — AA small text needs ${AA_SMALL}:1`, vars, lightSeen);
measure(componentPairs, 'Light · text, badges and buttons', vars, lightSeen);

if (darkVars) {
  // Same pairs, dark palette. `white` here is the card surface, because dark
  // mode redefines it — which is exactly the substitution the browser makes.
  const darkSeen = new Set();
  measure(chipPairs, 'Dark · materia medica chips', darkVars, darkSeen);
  measure(componentPairs, 'Dark · text, badges and buttons', darkVars, darkSeen);
} else {
  console.log('\nNo dark palette found in the stylesheet — dark pairs not measured.');
}

/* Two regression guards.

   The first is for the failure this script was written to catch: jade-600 is a
   surface colour and does not carry white text.

   The second is for dark mode. `text-white` no longer means "white" — dark mode
   redefines `--color-white` to the card surface so every `bg-white` panel flips
   at once, which turns `text-white` on a coloured button into dark-on-dark. Text
   that must stay light belongs on `text-accent-fg`. */
const forbidden = [];
const whiteText = [];
function walkWhite(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkWhite(full);
    else if (/\.tsx?$/.test(entry.name) && /\btext-white\b/.test(fs.readFileSync(full, 'utf8'))) {
      whiteText.push(path.relative(root, full));
    }
  }
}
for (const dir of ['apps/web', 'packages/ui']) walkWhite(path.join(root, dir));

if (whiteText.length > 0) {
  console.log('\ntext-white inverts in dark mode. Text on a coloured surface needs text-accent-fg:');
  for (const file of whiteText) console.log(`  ${file}`);
  failures += whiteText.length;
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(tsx?|css)$/.test(entry.name)) {
      const body = fs.readFileSync(full, 'utf8');
      if (/bg-jade-600[^'"`]*text-white|text-white[^'"`]*bg-jade-600/.test(body)) {
        forbidden.push(path.relative(root, full));
      }
    }
  }
}
for (const dir of ['apps', 'packages']) walk(path.join(root, dir));

if (forbidden.length > 0) {
  console.log('\nWhite text on jade-600 is 3.30:1 and fails AA. Use jade-700:');
  for (const file of forbidden) console.log(`  ${file}`);
  failures += forbidden.length;
}

console.log(
  `\n${failures === 0 ? 'Every pair meets AA for small text.' : `${failures} problem(s) found.`}`,
);
process.exit(failures === 0 ? 0 : 1);
