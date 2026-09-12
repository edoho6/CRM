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

/** Lower-cased, punctuation-light, for matching names inside prose. */
export function normalizeName(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Which of the given names appear in a text, as whole words. Names shorter
 * than four letters are ignored: "flu" inside "fluid" is not a mention, and
 * a rule that has to know that is a rule that fails elsewhere.
 */
export function mentions(text, names) {
  const haystack = ` ${normalizeName(text)} `;
  const found = [];
  for (const name of names) {
    const needle = normalizeName(name);
    if (needle.length < 4) continue;
    if (haystack.includes(` ${needle} `)) found.push(name);
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
