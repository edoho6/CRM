import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import type { MedEntry, MedLinkedEntry } from '@clinic/db/types';
import { MedicineBody } from './medicine-body';

/**
 * The entry body rendered with the real seed corpus.
 *
 * The sandbox database has no medicine tables until the migration is run,
 * so the smoke only ever sees the empty list. This renders every entry of
 * the dataset the importer loads — the same JSON, the same messages — and
 * checks that nothing throws, that no message key leaks onto the page, and
 * that a dose reaches the reader exactly as the label states it.
 */

const here = new URL('./', import.meta.url);
const messages = JSON.parse(readFileSync(new URL('../../../../packages/i18n/messages/he.json', here), 'utf8'));
const dataset = JSON.parse(gunzipSync(readFileSync(new URL('../../../../supabase/seed/medicine/dataset.json.gz', here))).toString('utf8')) as {
  entries: Array<Omit<MedEntry, 'id' | 'hebrew_stale' | 'image' | 'search_text' | 'created_at' | 'updated_at'>>;
};

/** A seed entry as the database would hand it back. */
function asRow(entry: (typeof dataset.entries)[number], index: number): MedEntry {
  return {
    ...entry,
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    hebrew_stale: false,
    image: null,
    search_text: '',
    created_at: '2026-09-12T00:00:00Z',
    updated_at: '2026-09-12T00:00:00Z',
  };
}

function render(entry: MedEntry, links: MedLinkedEntry[] = [], headingLevel: 'h2' | 'h3' = 'h2') {
  return renderToString(
    createElement(NextIntlClientProvider, {
      locale: 'he',
      messages,
      timeZone: 'Asia/Jerusalem',
      children: createElement(MedicineBody, { entry, links, headingLevel }),
    }),
  );
}

const rows = dataset.entries.map(asRow);
const byQid = (qid: string) => rows.find((row) => row.wikidata_id === qid)!;

describe('MedicineBody with the seed corpus', () => {
  // The full corpus is over a thousand entries; rendering them all takes a
  // while, and is the point.
  it('renders every entry of the dataset without a leaked message key', { timeout: 600_000 }, () => {
    expect(rows.length).toBeGreaterThan(40);
    for (const row of rows) {
      const html = render(row);
      expect(html, row.name_en).not.toMatch(/medicine\.[a-zA-Z_.]+/);
      expect(html, row.name_en).toContain('לתשומת לב');
    }
  });

  it('carries a dose to the reader exactly as the label states it', () => {
    const html = render(byQid('Q19484'));
    expect(html).toContain('מינון ואופן הנטילה');
    expect(html).toContain('500 מ״ג');
    expect(html).toContain('2,000 מ״ג');
    // The verbatim label sits beside the Hebrew, left to right, with its licence.
    expect(html).toContain('dir="ltr"');
    expect(html).toContain('500 mg orally once daily with the evening meal');
    expect(html).toContain('CC0 1.0 (openFDA)');
    // Hand-written Hebrew is labelled as such, and a drug links to the Israeli registry.
    expect(html).toContain('נכתב ידנית מהמקורות');
    expect(html).toContain('israeldrugs.health.gov.il');
  });

  it('folds every section but the overview, and moves the standing to the sources', () => {
    const row = rows.find((entry) => entry.kind === 'condition' && Object.keys(entry.sections?.he ?? {}).length >= 3)!;
    const html = render(row);
    // One section open — the overview — and the rest shut; the quotes and
    // the sources are shut groups of their own.
    expect(html.match(/<details open=""/g)).toHaveLength(1);
    expect(html).toMatch(/<details open=""[^>]*>\s*<summary[^>]*>.*?סקירה/s);
    expect(html.match(/<details/g)!.length).toBeGreaterThanOrEqual(Object.keys(row.sections!.he!).length + 1);
    // The summary is the overview's first sentences: the overview alone shows them.
    expect(html).not.toContain('<p class="text-base text-ink-900">');
    const bare = rows.find((entry) => entry.summary_he && !entry.sections?.he);
    if (bare) expect(render(bare)).toContain(`<p class="text-base text-ink-900">${bare.summary_he!.slice(0, 20)}`);
    // The status is on the sources row, after the text — not before it.
    const status = html.search(/הוצלב|טרם הוצלב|אומת/);
    const overview = html.indexOf('סקירה');
    expect(status).toBeGreaterThan(overview);
  });

  it('shows a lab test with its LOINC code and the laboratory-range warning', () => {
    const row = rows.find((entry) => entry.kind === 'lab_test' && entry.identifiers.loinc);
    if (!row) return; // the corpus has no lab tests yet
    const html = render(row);
    expect(html).toContain('LOINC');
    expect(html).toContain(row.identifiers.loinc);
    expect(html).toContain('הטווח התקין משתנה בין מעבדות');
  });

  it('shows the Israeli products of a drug, and never a leaflet’s text', () => {
    const row = rows.find((entry) => entry.israel?.products.length);
    if (!row) return; // the Israeli layer has not been fetched
    const html = render(row);
    expect(html).toContain('התכשירים הרשומים בישראל');
    expect(html).toContain(row.israel!.products[0].name_he);
    if (row.israel!.leaflet) expect(html).toContain(row.israel!.leaflet.url);
  });

  it('marks Hebrew that is quoted from Wikipedia, with its licence', () => {
    const row = rows.find((entry) => entry.hebrew_meta?.model === 'wikipedia-he');
    if (!row) return;
    const html = render(row);
    expect(html).toContain('מצוטט מוויקיפדיה העברית');
    expect(html).toContain('CC BY-SA 4.0');
    expect(html).toContain(row.hebrew_meta!.source!.url);
  });

  it('shows a condition with its MedlinePlus source and the cross-check label', () => {
    const html = render(byQid('Q2840'));
    expect(html).toContain('שפעת');
    expect(html).toContain('MedlinePlus');
    // The wording counts the sources, and the corpus keeps gaining them.
    expect(html).toMatch(/הוצלב (עם|בין)/);
    expect(html).not.toContain('israeldrugs.health.gov.il');
  });

  it('says so when an entry has no Hebrew sections yet', () => {
    const row = rows.find((entry) => !entry.sections?.he);
    if (!row) return; // every entry has Hebrew — nothing to say
    const html = render(row);
    expect(html).toMatch(/עדיין אין טקסט בעברית|התקציר בעברית מגיע מוויקידאטה/);
  });

  it('names the identity check when two sources file the entry under one code', () => {
    const row = rows.find((entry) => entry.cross_check?.identity_confirmed);
    if (!row) return; // the sample corpus has no identity codes yet
    const html = render(row);
    expect(html).toContain('הזהות אומתה בין שני מקורות');
  });

  it('groups links by what they claim, in the reader’s direction', () => {
    const drug = byQid('Q19484');
    const condition = byQid('Q3025883');
    const html = render(drug, [
      { relation: 'treats', direction: 'out', source: 'wikidata:P2176', entry: { id: condition.id, slug: condition.slug, kind: 'condition', name_he: condition.name_he, name_en: condition.name_en } },
    ]);
    expect(html).toContain('מטפלת ב…');
    expect(html).toContain('סוכרת מסוג 2');
  });

  it('steps its headings down inside the dialog', () => {
    const html = render(byQid('Q19484'), [], 'h3');
    expect(html).toContain('<h3');
    expect(html).not.toContain('<h2');
  });
});
