import { describe, expect, it } from 'vitest';
import en from '@clinic/i18n/messages/en.json';
import he from '@clinic/i18n/messages/he.json';

/**
 * The two message files must say the same things.
 *
 * A missing key does not crash next-intl — it renders the key path, so
 * `appointments.outsideHours` appears on screen in place of a sentence. That is
 * the kind of bug that ships, because it only shows on the locale nobody was
 * testing in. This is the check the project rules ask for.
 *
 * Placeholders are compared as well. `{count}` present in Hebrew and absent in
 * English is a number that silently disappears from one translation, which no
 * key-name comparison would catch.
 */

type Messages = { [key: string]: string | Messages };

/** Every leaf, as `a.b.c` → the string. */
function flatten(messages: Messages, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

/**
 * The ICU argument names in a message, ignoring order and repetition.
 *
 * Depth-aware rather than a plain regex, because a plural body is also written in
 * braces: `{count, plural, one {1 patient} other {# patients}}` has one argument
 * and two bodies, and matching every `{` would read `1 patient` as an argument
 * name. Hebrew's `two` category, which English does not have, would then make
 * every plural in the file look like a mismatch.
 *
 * Only top-level arguments are collected. An argument nested inside a plural body
 * is not compared — vanishingly rare here, and the outer argument still is.
 */
function placeholders(message: string): string[] {
  const names: string[] = [];
  let depth = 0;

  for (let index = 0; index < message.length; index += 1) {
    const char = message[index];
    if (char === '}') {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (char !== '{') continue;

    if (depth === 0) {
      const name = /^\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*[,}]/.exec(message.slice(index))?.[1];
      if (name) names.push(name);
    }
    depth += 1;
  }

  return [...new Set(names)].sort();
}

const flatHe = flatten(he as Messages);
const flatEn = flatten(en as Messages);

/*
 * The extractor is tested before it is trusted. A parity check that silently
 * finds nothing is worse than no check, because it reads as a passing one.
 */
describe('placeholder extraction', () => {
  it('reads a plain argument', () => {
    expect(placeholders('Hello {name}, you have {n} messages')).toEqual(['n', 'name']);
  });

  it('reads the argument of a plural and not its bodies', () => {
    expect(placeholders('{count, plural, =0 {No patients} one {1 patient} other {# patients}}')) //
      .toEqual(['count']);
  });

  it("does not care that Hebrew has a category English lacks", () => {
    const heMessage = '{count, plural, one {מטופל אחד} two {שני מטופלים} other {# מטופלים}}';
    const enMessage = '{count, plural, one {1 patient} other {# patients}}';
    expect(placeholders(heMessage)).toEqual(placeholders(enMessage));
  });

  it('reads an argument that follows a plural', () => {
    expect(placeholders('{count, plural, other {# records}} by {who}')).toEqual(['count', 'who']);
  });

  it('notices a dropped argument', () => {
    expect(placeholders('Booked {count} appointments')).not.toEqual(placeholders('Booked them'));
  });

  it('finds nothing in a message with no arguments', () => {
    expect(placeholders('שעות עבודה')).toEqual([]);
  });
});

describe('message files', () => {
  it('has no key in Hebrew that is missing from English', () => {
    const missing = [...flatHe.keys()].filter((key) => !flatEn.has(key));
    expect(missing).toEqual([]);
  });

  it('has no key in English that is missing from Hebrew', () => {
    const missing = [...flatEn.keys()].filter((key) => !flatHe.has(key));
    expect(missing).toEqual([]);
  });

  it('has no empty translations', () => {
    const empty = [...flatHe, ...flatEn]
      .filter(([, value]) => value.trim() === '')
      .map(([key]) => key);
    expect(empty).toEqual([]);
  });

  it('uses the same placeholders in both languages', () => {
    const mismatched = [...flatHe]
      .filter(([key, value]) => {
        const other = flatEn.get(key);
        if (other === undefined) return false; // reported by its own test
        return placeholders(value).join() !== placeholders(other).join();
      })
      .map(([key]) => key);
    expect(mismatched).toEqual([]);
  });
});
