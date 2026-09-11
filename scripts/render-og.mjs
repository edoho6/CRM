// Renders the picture a link to the product's page shows when it is pasted
// into WhatsApp or a search result (1200 × 630, one per language) — with the
// same headless Edge the smoke runs in, so no image library and no font
// bundling: the system's own fonts draw the Hebrew. Run once after the text
// or the icon changes:  node scripts/render-og.mjs
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const root = process.cwd();
const icon = fs.readFileSync(path.join(root, 'apps/web/app/icon.svg'), 'utf8');
const messages = {
  he: JSON.parse(fs.readFileSync(path.join(root, 'packages/i18n/messages/he.json'), 'utf8')),
  en: JSON.parse(fs.readFileSync(path.join(root, 'packages/i18n/messages/en.json'), 'utf8')),
};

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });

for (const locale of ['he', 'en']) {
  const m = messages[locale];
  const dir = locale === 'he' ? 'rtl' : 'ltr';
  await page.setContent(`<!doctype html><html dir="${dir}"><head><meta charset="utf-8"><style>
    html,body{margin:0;width:1200px;height:630px;background:#f4f6f3;font-family:"Segoe UI",Arial,"Noto Sans Hebrew",sans-serif;color:#1c2420}
    .card{box-sizing:border-box;width:1200px;height:630px;padding:72px 88px;display:flex;flex-direction:column;justify-content:space-between}
    .brand{display:flex;align-items:center;gap:22px}
    .brand img{width:88px;height:88px;border-radius:22px}
    .name{font-size:44px;font-weight:700;line-height:1.1}
    .tag{font-size:24px;color:#586360;margin-top:6px}
    .hero{font-size:64px;font-weight:700;line-height:1.15;max-width:960px}
    .body{font-size:28px;line-height:1.4;color:#3b4642;max-width:1000px;margin-top:18px}
    .bar{height:12px;width:220px;border-radius:6px;background:#16a25c}
  </style></head><body><div class="card">
    <div class="brand"><img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(icon)}"><div><div class="name">${m.common.appName}</div><div class="tag">${m.common.appTagline}</div></div></div>
    <div><div class="hero">${m.site.hero.title}</div><div class="body">${m.site.hero.body}</div></div>
    <div class="bar"></div>
  </div></body></html>`);
  await page.locator('img').first().waitFor();
  const file = path.join(root, 'apps/web/public/og', `about-${locale}.png`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 1200, height: 630 } });
  console.log('wrote', path.relative(root, file));
}
await browser.close();
