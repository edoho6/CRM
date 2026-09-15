// Shared by the pull scripts: arguments and where the output goes.
//
// Everything pulled lands under test-results/pull/ on purpose — that folder
// is git-ignored, and what these scripts fetch is the user's own account data,
// which must never reach the repository.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);

/** `--key=value` and `--flag` into an object; anything else is a mistake worth stopping on. */
export function parseArgs(argv) {
  const args = {};
  for (const raw of argv) {
    const match = /^--([a-z][a-z0-9-]*)(?:=(.*))?$/i.exec(raw);
    if (!match) throw new Error(`unexpected argument: ${raw}`);
    args[match[1]] = match[2] ?? true;
  }
  return args;
}

/** A site name becomes a folder name in two places; keep it to what every file system accepts. */
export function siteName(value) {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]{0,40}$/.test(value)) {
    throw new Error(
      '--site must be a short name in lower-case letters, digits and dashes (for example --site=meta or --site=my-bank)',
    );
  }
  return value;
}

/** yyyymmdd-hhmmss in local time, so output folders sort by run. */
export function runStamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

export function outputDir(site, custom) {
  const dir = custom
    ? path.resolve(String(custom))
    : path.join(REPO_ROOT, 'test-results', 'pull', site, runStamp());
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeJson(dir, name, data) {
  const file = path.join(dir, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return file;
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
