/**
 * Shrinks the reference photographs to what a card needs.
 *
 * The sources hand out photographs at whatever size they were uploaded —
 * a few were fourteen megabytes — and 324 of them came to fifty. A card
 * shows them at most a few hundred pixels wide, so 640 px on the long side
 * at quality 80 is indistinguishable there and about a twentieth of the
 * weight. Runs in place over apps/web/public/herbs; a file already at or
 * under the size is left alone.
 *
 * `sharp` comes with Next.js, so nothing has to be installed; it is found
 * in the pnpm store rather than imported by name.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'apps', 'web', 'public', 'herbs');
const MAX = 640;

export function loadSharp() {
  const store = path.join(root, 'node_modules', '.pnpm');
  const entry = fs.readdirSync(store).find((name) => name.startsWith('sharp@'));
  if (!entry) return null;
  const require = createRequire(import.meta.url);
  try {
    return require(path.join(store, entry, 'node_modules', 'sharp'));
  } catch {
    return null;
  }
}

export async function shrink(sharp, file) {
  // From a buffer, not the path: sharp keeps a path open until it is
  // collected, and Windows refuses to overwrite a file that is still open.
  const image = sharp(fs.readFileSync(file), { failOn: 'none' });
  const meta = await image.metadata();
  const longest = Math.max(meta.width ?? 0, meta.height ?? 0);
  const buffer = await image
    .rotate()
    .resize({ width: MAX, height: MAX, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
  const before = fs.statSync(file).size;
  if (buffer.length < before || longest > MAX) fs.writeFileSync(file, buffer);
  return { before, after: fs.statSync(file).size, longest };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sharp = loadSharp();
  if (!sharp) {
    console.error('sharp not found in node_modules/.pnpm');
    process.exit(1);
  }
  let total = { before: 0, after: 0 };
  for (const name of fs.readdirSync(dir)) {
    if (!/\.(jpe?g|png)$/i.test(name)) continue;
    const { before, after } = await shrink(sharp, path.join(dir, name));
    total.before += before;
    total.after += after;
  }
  console.log(
    `${(total.before / 1048576).toFixed(1)} MB → ${(total.after / 1048576).toFixed(1)} MB`,
  );
}
