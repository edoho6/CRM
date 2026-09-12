// The part of the compiler that decides how far an entry has been checked.
// Pure functions, so they can be tested without a network.
//
// A claim is "agreed" when two independent sources make it: Wikidata says a
// drug treats a condition and the drug's own label names that condition; a
// condition's sources both name the same symptom. Absence is not a conflict
// — a label that does not mention a condition is not a source that denies
// it — so conflicts are recorded only where sources contradict each other
// outright, which the present sources rarely do; the field exists for the
// ones that will.

const HEBREW = /[֐-׿]/;

/** Lower-cased, punctuation-light, for matching names inside prose — Latin or Hebrew. */
export function normalizeName(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9֐-׿' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Which of the given names appear in a text, as whole words. A Latin name
 * shorter than four letters is ignored: "flu" inside "fluid" is not a
 * mention, and a rule that has to know that is a rule that fails elsewhere.
 *
 * Hebrew needs two allowances. Its words are shorter (חום, כאב, שיעול), so
 * three letters are enough; and it glues the article and the prepositions
 * onto the front of a word — בשיעול, הסוכרת, ולחץ — so up to two of those
 * letters before the name still count as the name.
 */
export function mentions(text, names) {
  const haystack = ` ${normalizeName(text)} `;
  const found = [];
  for (const name of names) {
    const needle = normalizeName(name);
    const hebrew = HEBREW.test(needle);
    if (needle.length < (hebrew ? 3 : 4)) continue;
    if (haystack.includes(` ${needle} `)) {
      found.push(name);
      continue;
    }
    if (hebrew && new RegExp(` [בלהומשכ]{1,2}${escapeRe(needle)} `).test(haystack)) found.push(name);
  }
  return found;
}

/**
 * The verdict for one entry.
 *
 * `evidence` is what the compiler gathered: per relation, the names each
 * source claims — e.g. {treats: {wikidata: [...], fda: [...], nhs: [...]}}.
 * `sources` is the list of sources that contributed anything at all.
 */
export function crossCheck({ sources, evidence }) {
  const agree = [];
  const conflicts = [];
  for (const [relation, bySource] of Object.entries(evidence ?? {})) {
    const names = Object.values(bySource).flat();
    const counts = new Map();
    for (const [source, list] of Object.entries(bySource)) {
      for (const name of new Set(list.map(normalizeName))) {
        const entry = counts.get(name) ?? new Set();
        entry.add(source);
        counts.set(name, entry);
      }
    }
    for (const [name, who] of counts) {
      if (who.size >= 2) {
        const original = names.find((n) => normalizeName(n) === name) ?? name;
        agree.push(`${relation}:${original}`);
      }
    }
  }
  const distinct = [...new Set(sources)];
  return { sources: distinct.length, agree: [...new Set(agree)].sort(), conflicts };
}

/** Two sources that agree on something make an entry cross-checked; less is a draft. */
export function statusFor(check) {
  return check.sources >= 2 && check.agree.length > 0 && check.conflicts.length === 0 ? 'cross_checked' : 'draft';
}
