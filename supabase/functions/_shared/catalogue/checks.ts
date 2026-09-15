// What is checked after the writer has written, without a model: every
// number in the text must exist on the fact sheet, and no run of words may
// be lifted from a source. Sentences that fail are removed, not the entry —
// the same rule the library answers follow.

/** Every number in a text, as written ("1.5", "10", "0,5" → "0.5"). */
export function numbersIn(text: string): string[] {
  return [...String(text ?? '').matchAll(/\d+(?:[.,]\d+)?/g)].map((match) =>
    match[0].replace(',', '.').replace(/\.0+$/, ''),
  );
}

/** The numbers a fact sheet contains anywhere, as a set the text may draw on. */
export function factNumbers(sheet: unknown): Set<string> {
  return new Set(numbersIn(JSON.stringify(sheet)));
}

/** The numbers in a text that the sheet does not contain. */
export function unsupportedNumbers(text: string, allowed: Set<string>): string[] {
  return [...new Set(numbersIn(text))].filter((number) => !allowed.has(number));
}

/**
 * A text as the units the checks judge: bullet lines are units, and a line
 * of prose splits at sentence ends. Empty units are dropped.
 */
export function units(text: string): string[] {
  const out: string[] = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^[•\-*·]/.test(trimmed)) {
      out.push(trimmed);
      continue;
    }
    for (const sentence of trimmed.split(/(?<=[.!?;])\s+(?=[^\s])/)) {
      if (sentence.trim()) out.push(sentence.trim());
    }
  }
  return out;
}

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[״׳"'`’‘“”]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Does a unit contain the quote (or its first six words, when the judge shortened it)? */
export function unitMatches(unit: string, quote: string): boolean {
  const a = normalizeForMatch(unit);
  const b = normalizeForMatch(quote);
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  const head = b.split(' ').slice(0, 6).join(' ');
  return head.split(' ').length >= 4 && a.includes(head);
}

/** The text without the units that match any of the quotes; bullets keep their lines, prose is re-joined. */
export function removeUnits(text: string, quotes: string[]): { text: string; removed: number } {
  if (quotes.length === 0) return { text, removed: 0 };
  let removed = 0;
  const lines: string[] = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      lines.push('');
      continue;
    }
    if (/^[•\-*·]/.test(trimmed)) {
      if (quotes.some((quote) => unitMatches(trimmed, quote))) removed += 1;
      else lines.push(line);
      continue;
    }
    const kept = trimmed.split(/(?<=[.!?;])\s+(?=[^\s])/).filter((sentence) => {
      const drop = quotes.some((quote) => unitMatches(sentence, quote));
      if (drop) removed += 1;
      return !drop;
    });
    if (kept.length) lines.push(kept.join(' '));
  }
  return {
    text: lines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
    removed,
  };
}

/** The units of a text that carry a number the sheet does not have. */
export function unitsWithUnsupportedNumbers(text: string, allowed: Set<string>): string[] {
  return units(text).filter((unit) => unsupportedNumbers(unit, allowed).length > 0);
}

function words(text: string): string[] {
  return normalizeForMatch(text).split(' ').filter(Boolean);
}

/**
 * Runs of `n` consecutive words that appear both in the text and in a
 * source text — the sign of copying rather than saying. Returns the
 * offending runs, each once.
 */
export function sharedRuns(text: string, sources: string[], n = 7): string[] {
  const sourceGrams = new Set<string>();
  for (const source of sources) {
    const w = words(source);
    for (let i = 0; i + n <= w.length; i += 1) sourceGrams.add(w.slice(i, i + n).join(' '));
  }
  if (sourceGrams.size === 0) return [];
  const found = new Set<string>();
  const w = words(text);
  for (let i = 0; i + n <= w.length; i += 1) {
    const gram = w.slice(i, i + n).join(' ');
    if (sourceGrams.has(gram)) found.add(gram);
  }
  return [...found];
}

/** The units of a text that contain a shared run. */
export function unitsWithSharedRuns(text: string, sources: string[], n = 7): string[] {
  const runs = sharedRuns(text, sources, n);
  if (runs.length === 0) return [];
  return units(text).filter((unit) => {
    const normalized = normalizeForMatch(unit);
    return runs.some((run) => normalized.includes(run));
  });
}
