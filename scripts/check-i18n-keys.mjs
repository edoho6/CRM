/**
 * Every message key the code asks for must exist in the catalogue.
 *
 * A missing key does not fail the build: next-intl renders the key's name
 * and logs, so "encounters.newPicker.title" appears on screen in the middle
 * of Hebrew. This walks every component, finds `useTranslations('ns')` /
 * `getTranslations('ns')` (and the `{ namespace }` form) bound to a variable,
 * then every literal `variable('key')` call, and checks `ns.key` in he.json.
 *
 * Bindings are resolved by position: a call uses the nearest earlier binding
 * of the same name, so a file with two components that each bind `t` to a
 * different namespace is read the way the code runs. Template-literal keys
 * (`t(\`status.${x}\`)`) are checked by their static prefix only: the prefix
 * must be a group.
 *
 * Usage: node scripts/check-i18n-keys.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const catalogue = JSON.parse(readFileSync(join(root, 'packages/i18n/messages/he.json'), 'utf8'));

const ROOTS = ['apps/web/app', 'apps/web/features', 'apps/web/components', 'apps/portal/app'];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      yield* walk(full);
    } else if (/\.(tsx?|mjs)$/.test(entry)) {
      yield full;
    }
  }
}

function lookup(path) {
  let node = catalogue;
  for (const part of path.split('.')) {
    if (node === null || typeof node !== 'object' || !(part in node)) return undefined;
    node = node[part];
  }
  return node;
}

const problems = [];
let checked = 0;

const BIND_RE =
  /const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:'([^']*)'|\{[^}]*namespace:\s*'([^']*)'[^}]*\})?\s*\)/g;

for (const dir of ROOTS) {
  for (const file of walk(join(root, dir))) {
    const source = readFileSync(file, 'utf8');
    const rel = relative(root, file);

    // Every binding, with where it happens.
    const bindings = [];
    let match;
    while ((match = BIND_RE.exec(source))) {
      bindings.push({ name: match[1], namespace: match[2] ?? match[3] ?? '', at: match.index });
    }
    if (bindings.length === 0) continue;

    const names = [...new Set(bindings.map((binding) => binding.name))];
    const namespaceAt = (name, position) => {
      let found = null;
      for (const binding of bindings) {
        if (binding.name === name && binding.at < position) found = binding.namespace;
      }
      return found;
    };

    for (const name of names) {
      // Literal keys: t('a.b'), t.has('a'), t.rich('a', …), t.raw('a')
      const callRe = new RegExp(`\\b${name}(?:\\.has|\\.rich|\\.raw)?\\(\\s*'([^']+)'`, 'g');
      while ((match = callRe.exec(source))) {
        const namespace = namespaceAt(name, match.index);
        if (namespace === null) continue;
        const key = namespace ? `${namespace}.${match[1]}` : match[1];
        checked += 1;
        if (lookup(key) === undefined) problems.push(`${rel}: missing "${key}"`);
      }
      // Template keys: t(`status.${x}`) — the static prefix must be a group.
      const tplRe = new RegExp(`\\b${name}(?:\\.has|\\.rich)?\\(\\s*\`([^\`$]*)\\$\\{`, 'g');
      while ((match = tplRe.exec(source))) {
        const namespace = namespaceAt(name, match.index);
        if (namespace === null) continue;
        const prefix = match[1].replace(/\.$/, '');
        if (!prefix) continue;
        const key = namespace ? `${namespace}.${prefix}` : prefix;
        checked += 1;
        const node = lookup(key);
        if (node === undefined || typeof node !== 'object') problems.push(`${rel}: missing group "${key}"`);
      }
    }
  }
}

console.log(`${checked} message references checked`);
if (problems.length > 0) {
  console.log(`\n${problems.length} problem(s):`);
  for (const problem of problems) console.log(`  ${problem}`);
  process.exit(1);
}
console.log('PASS — every key the code asks for exists in he.json.');
