// Renders the app icon (app/icon.svg, the leaf on jade) to the PNG sizes a
// home screen wants — 180 for iOS, 192 and 512 for Android, plus a maskable
// 512 with the leaf inset — using the same headless Edge the smoke runs in,
// so there is no image library to install. Run once per app after the SVG
// changes:  node scripts/render-icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const root = process.cwd();
const apps = ['apps/web', 'apps/portal'];

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });

/** The SVG as a data URL; `inset` shrinks the leaf into the safe zone of a maskable icon. */
function svgUrl(source, inset) {
  const svg = inset
    ? source
        .replace(/<rect[^>]*\/>/, '<rect width="64" height="64" fill="#16a25c"/>')
        .replace('<path ', '<g transform="translate(6.4 6.4) scale(0.8)"><path ')
        .replace('</svg>', '</g></svg>')
    : source;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function render(source, size, inset, file) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}img{display:block;width:${size}px;height:${size}px}</style><img src="${svgUrl(source, inset)}">`,
  );
  await page.locator('img').first().waitFor();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  console.log('wrote', path.relative(root, file));
}

for (const app of apps) {
  const source = fs.readFileSync(path.join(root, app, 'app/icon.svg'), 'utf8');
  await render(source, 180, false, path.join(root, app, 'app/apple-icon.png'));
  await render(source, 192, false, path.join(root, app, 'public/icons/icon-192.png'));
  await render(source, 512, false, path.join(root, app, 'public/icons/icon-512.png'));
  await render(source, 512, true, path.join(root, app, 'public/icons/icon-512-maskable.png'));
}
await browser.close();
