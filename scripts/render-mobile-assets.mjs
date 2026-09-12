// The source images the store apps' icons and splash screens are generated
// from, drawn from app/icon.svg (the leaf on jade) with the same headless
// Edge the smoke runs in, so there is no image library to install:
//
//   apps/mobile-<app>/assets/icon-only.png        1024²  the icon as it is
//   apps/mobile-<app>/assets/icon-foreground.png  1024²  the leaf alone, inside the
//                                                        safe zone of an Android adaptive icon
//   apps/mobile-<app>/assets/icon-background.png  1024²  the jade
//   apps/mobile-<app>/assets/splash.png           2732²  the leaf, small, on the jade
//   apps/mobile-<app>/assets/splash-dark.png      2732²  the same (the jade is the brand in both themes)
//
// `@capacitor/assets` cuts every size the two platforms want from these
// (the `assets` script of each shell). Run after the SVG changes:
//   node scripts/render-mobile-assets.mjs && pnpm --filter @clinic/mobile-clinic assets && pnpm --filter @clinic/mobile-portal assets
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const root = process.cwd();
const JADE = '#16a25c';
const shells = [
  { app: 'clinic', icon: 'apps/web/app/icon.svg' },
  { app: 'portal', icon: 'apps/portal/app/icon.svg' },
];

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });

/** The leaf alone — the jade square dropped — centred at `scale` of the canvas. */
function leafOnly(source, scale) {
  const inset = (64 * (1 - scale)) / 2;
  return source
    .replace(/<rect[^>]*\/>/, '')
    .replace('<path ', `<g transform="translate(${inset} ${inset}) scale(${scale})"><path `)
    .replace('</svg>', '</g></svg>');
}

/** A whole square of jade. */
function jadeOnly(source) {
  return source.replace(/<rect[^>]*\/>/, `<rect width="64" height="64" fill="${JADE}"/>`).replace(/<path [^>]*\/>/, '');
}

async function render(svg, size, background, file) {
  await page.setViewportSize({ width: size, height: size });
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await page.setContent(
    `<style>html,body{margin:0;background:${background}}img{display:block;width:${size}px;height:${size}px}</style><img src="${url}">`,
  );
  await page.locator('img').first().waitFor();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, omitBackground: background === 'transparent', clip: { x: 0, y: 0, width: size, height: size } });
  console.log('wrote', path.relative(root, file));
}

for (const { app, icon } of shells) {
  const source = fs.readFileSync(path.join(root, icon), 'utf8');
  const dir = path.join(root, 'apps', `mobile-${app}`, 'assets');
  for (const stale of ['logo.png', 'logo-dark.png']) fs.rmSync(path.join(dir, stale), { force: true });
  await render(source, 1024, 'transparent', path.join(dir, 'icon-only.png'));
  await render(leafOnly(source, 0.66), 1024, 'transparent', path.join(dir, 'icon-foreground.png'));
  await render(jadeOnly(source), 1024, JADE, path.join(dir, 'icon-background.png'));
  // The splash: the leaf at a fifth of the width, as a mark rather than a picture.
  await render(leafOnly(source, 0.2), 2732, JADE, path.join(dir, 'splash.png'));
  await render(leafOnly(source, 0.2), 2732, JADE, path.join(dir, 'splash-dark.png'));
}
await browser.close();
