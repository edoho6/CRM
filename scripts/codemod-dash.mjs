/**
 * One-off: replace the hand-drawn "no value" span with the shared <Dash />.
 *
 * Adds `Dash` to the file's existing `@clinic/ui` import, or a new import
 * line when there is none. Run once; kept in the repo as a record of how
 * the change was made, not as something to run again.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const SPAN = '<span className="text-ink-500">—</span>';
const files = process.argv.slice(2);

for (const file of files) {
  let source = readFileSync(file, 'utf8');
  if (!source.includes(SPAN)) continue;
  source = source.split(SPAN).join('<Dash />');

  const multi = /import \{([^}]*)\} from '@clinic\/ui';/;
  const match = multi.exec(source);
  if (match) {
    if (!/\bDash\b/.test(match[1])) {
      const names = match[1].trim().replace(/,\s*$/, '');
      const isMultiline = match[1].includes('\n');
      const replacement = isMultiline
        ? `import {${match[1].replace(/\n\} *$/, '')}\n  Dash,\n} from '@clinic/ui';`
        : `import { ${names}, Dash } from '@clinic/ui';`;
      source = source.replace(multi, isMultiline ? replacement.replace(/,\n  Dash,\n\}/, ',\n  Dash,\n}') : replacement);
    }
  } else {
    // After the last import line.
    const lines = source.split('\n');
    let last = -1;
    lines.forEach((line, index) => {
      if (/^import /.test(line)) last = index;
    });
    lines.splice(last + 1, 0, "import { Dash } from '@clinic/ui';");
    source = lines.join('\n');
  }
  writeFileSync(file, source);
  console.log('dash:', file);
}
