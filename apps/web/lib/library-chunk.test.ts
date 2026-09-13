import { describe, expect, it } from 'vitest';
import { chunkPages, estimateTokens, looksLikeHeading } from '../../../scripts/library/lib/chunk.mjs';

const paragraph = (n: number, words = 60) => Array.from({ length: words }, (_, i) => `word${n}-${i}`).join(' ') + '.';

describe('chunkPages', () => {
  it('keeps whole paragraphs, opens each passage with the tail of the one before, and carries the page', () => {
    const pages = [
      { page: 1, text: `Chapter One\n\n${paragraph(1)}\n\n${paragraph(2)}` },
      { page: 2, text: `${paragraph(3)}\n\n${paragraph(4)}\n\n${paragraph(5)}` },
    ];
    const chunks = chunkPages(pages, { maxChars: 1200, overlapChars: 200 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]!.ordinal).toBe(0);
    expect(chunks[0]!.page).toBe(1);
    expect(chunks[0]!.heading).toBe('Chapter One');
    for (const chunk of chunks) expect(chunk.content.length).toBeLessThanOrEqual(1200 + 400);
    // The second passage starts with the end of the first.
    const tail = chunks[0]!.content.slice(-60);
    expect(chunks[1]!.content.startsWith(tail.slice(tail.search(/\s/) + 1).slice(0, 20)) || chunks[1]!.content.includes(chunks[0]!.content.slice(-30))).toBe(true);
    expect(chunks.at(-1)!.page).toBe(2);
    expect(chunks.every((chunk) => chunk.tokens === estimateTokens(chunk.content))).toBe(true);
  });

  it('cuts a paragraph longer than a passage at sentence ends', () => {
    const long = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} says something useful about the herb.`).join(' ');
    const chunks = chunkPages([{ page: null, text: long }], { maxChars: 500, overlapChars: 0 });
    expect(chunks.length).toBeGreaterThan(3);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(500);
      expect(chunk.content).toMatch(/\.$/);
    }
  });

  it('returns nothing for empty text', () => {
    expect(chunkPages([{ page: 1, text: '   \n\n ' }])).toEqual([]);
  });
});

describe('looksLikeHeading', () => {
  it('recognises numbered, hashed and title-case lines, not sentences', () => {
    expect(looksLikeHeading('## Dosage and administration')).toBe(true);
    expect(looksLikeHeading('3.2 Contraindications')).toBe(true);
    expect(looksLikeHeading('Formulas That Release the Exterior')).toBe(true);
    expect(looksLikeHeading('The dose is 9 grams, taken twice a day.')).toBe(false);
    expect(looksLikeHeading('')).toBe(false);
  });
});
