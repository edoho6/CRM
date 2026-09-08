import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import he from '@clinic/i18n/messages/he.json';

/**
 * Every `t('…')` in the source resolves to a message that exists.
 *
 * The parity test compares the two files against each other, which cannot see a
 * key that is missing from both — and that is the failure that actually reaches
 * the screen, as the literal string `reference.points.englishName` where a label
 * should be. It happens when a namespace is guessed rather than looked up, which
 * is exactly the moment nobody checks.
 *
 * Only literal keys are checked. `t(\`status.${value}\`)` cannot be resolved
 * without running the code, and a test that guessed at it would fail on correct
 * code — which is worse than not checking, because it gets switched off.
 */

type Messages = { [key: string]: string | Messages };

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');

/*
 * Both applications, from the one test.
 *
 * The portal draws on the same message files and is the half a patient sees, so
 * a key missing there is a raw dotted path in front of the person the clinic is
 * trying to look competent to. It has no test setup of its own and does not need
 * one for this — the check is a file scan, and the files are next door.
 */
const ROOTS = [
  { root: webRoot, dirs: ['app', 'features', 'components'] },
  { root: path.resolve(here, '../../portal'), dirs: ['app'] },
];

/** `const tFoo = useTranslations('ns')` and the `await getTranslations` form. */
const NAMESPACE_RE =
  /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*'([^']*)'\s*\)/g;

/** `tFoo('key')` — single-quoted literal only, so template literals are skipped. */
const CALL_RE = /\b(\w+)\(\s*'([A-Za-z0-9_.]+)'/g;

function has(messages: Messages, dotted: string): boolean {
  let node: string | Messages | undefined = messages;
  for (const segment of dotted.split('.')) {
    if (typeof node !== 'object' || node === null) return false;
    node = node[segment];
    if (node === undefined) return false;
  }
  // A namespace is not a message. `t('fields')` where `fields` is an object
  // renders nothing useful, so it counts as missing.
  return typeof node === 'string';
}

interface Missing {
  file: string;
  key: string;
}

/** Every `.tsx` under a directory. Hand-rolled to avoid a dependency for nine lines. */
function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      out.push(...tsxFiles(full));
    } else if (entry.name.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

function scan(): Missing[] {
  const files = ROOTS.flatMap(({ root, dirs }) =>
    dirs.flatMap((dir) => tsxFiles(path.join(root, dir))),
  );

  const missing: Missing[] = [];

  for (const file of files) {
    const source = readFileSync(file, 'utf8');

    /*
     * Declarations with their position, not a plain name→namespace map.
     *
     * One file routinely holds several components, and each declares its own
     * `t`. Keeping only the last one resolves the first component's calls
     * against the wrong namespace and reports keys that are perfectly fine —
     * which is how a checker gets switched off. Each call is matched to the
     * nearest declaration above it instead, which is what the reader does.
     */
    const declarations: { name: string; namespace: string; at: number }[] = [];
    for (const match of source.matchAll(NAMESPACE_RE)) {
      declarations.push({ name: match[1]!, namespace: match[2]!, at: match.index! });
    }
    if (declarations.length === 0) continue;

    for (const match of source.matchAll(CALL_RE)) {
      const name = match[1]!;
      const at = match.index!;
      const declaration = declarations
        .filter((entry) => entry.name === name && entry.at < at)
        .pop();
      if (!declaration) continue;

      const full = declaration.namespace ? `${declaration.namespace}.${match[2]!}` : match[2]!;
      if (!has(he as Messages, full)) {
        missing.push({ file: path.relative(webRoot, file).replace(/\\/g, '/'), key: full });
      }
    }
  }

  return missing;
}

describe('message keys used in the source', () => {
  it('all resolve to a message that exists', () => {
    const missing = scan();
    expect(missing.map((entry) => `${entry.key}  (${entry.file})`)).toEqual([]);
  });

  it('would notice a key that is not there', () => {
    // Guards the scanner itself: a check that silently finds nothing reads
    // exactly like a passing one.
    expect(has(he as Messages, 'reference.compare.title')).toBe(true);
    expect(has(he as Messages, 'reference.compare.notAKeyAnyoneWrote')).toBe(false);
    // A namespace is not a message.
    expect(has(he as Messages, 'reference.compare')).toBe(false);
  });
});
