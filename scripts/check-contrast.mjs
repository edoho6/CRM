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

/** Tailwind emits a hex fallback beside each wide-gamut value; the hex is what we measure. */
const vars = new Map([['white', '#ffffff']]);
for (const m of css.matchAll(/--color-([a-z]+-\d+):\s*(#[0-9a-fA-F]{6})/g)) {
  if (!vars.has(m[1])) vars.set(m[1], m[2]);
}

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
  { bg: 'jade-700', fg: 'white', where: 'primary button, active nav' },
  { bg: 'amber-50', fg: 'amber-900', where: 'review notice' },
  { bg: 'sky-50', fg: 'sky-900', where: 'information notice' },
];

const AA_SMALL = 4.5;
let failures = 0;
const seen = new Set();

function measure(pairs, title) {
  console.log(`\n${title}`);
  for (const { bg, fg, where } of pairs) {
    const key = `${bg}|${fg}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const bgHex = vars.get(bg);
    const fgHex = vars.get(fg);
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
  console.log(`  ${pairs.length} pairs checked`);
}

measure(chipPairs, `Materia medica chips — AA small text needs ${AA_SMALL}:1`);
measure(componentPairs, 'Text, badges and buttons');

/* A regression guard for the one that was wrong: jade-600 is a surface colour
   and does not carry white text. jade-700 does. */
const forbidden = [];
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
