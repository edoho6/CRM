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
  it('renders every entry of the dataset without a leaked message key', () => {
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

  it('shows a condition with its MedlinePlus source and the cross-check label', () => {
    const html = render(byQid('Q2840'));
    expect(html).toContain('שפעת');
    expect(html).toContain('MedlinePlus');
    expect(html).toContain('הוצלב בין שני מקורות');
    expect(html).not.toContain('israeldrugs.health.gov.il');
  });

  it('says so when an entry has only a summary', () => {
    const html = render(byQid('Q845224'));
    expect(html).toContain('הפרעת חרדה מוכללת');
    expect(html).toContain('טרם הוצלב');
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
