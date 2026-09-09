import { describe, expect, it } from 'vitest';
import { buildIcs, icsDate, icsEscape, icsFold } from './ics';

describe('icsDate', () => {
  it('renders UTC without separators', () => {
    expect(icsDate(new Date('2026-09-10T07:30:00.000Z'))).toBe('20260910T073000Z');
  });
});

describe('icsEscape', () => {
  it('escapes the structural characters and newlines', () => {
    expect(icsEscape('a;b,c\\d\ne')).toBe('a\\;b\\,c\\\\d\\ne');
  });

  it('leaves Hebrew alone', () => {
    expect(icsEscape('דנה כהן')).toBe('דנה כהן');
  });
});

describe('icsFold', () => {
  it('leaves a short line as it is', () => {
    expect(icsFold('SUMMARY:short')).toBe('SUMMARY:short');
  });

  it('folds a long ASCII line at 75 octets with a leading space', () => {
    const line = 'SUMMARY:' + 'x'.repeat(100);
    const folded = icsFold(line);
    const parts = folded.split('\r\n');
    expect(parts[0]).toHaveLength(75);
    expect(parts[1]!.startsWith(' ')).toBe(true);
    expect(parts.join('').replace(/\r\n /g, '')).toBe(line.slice(0, 75) + ' ' + line.slice(75));
  });

  it('never splits inside a Hebrew letter', () => {
    const line = 'SUMMARY:' + 'א'.repeat(80);
    const folded = icsFold(line);
    for (const part of folded.split('\r\n')) {
      // Every piece decodes cleanly and fits the limit.
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
      expect(part.includes('�')).toBe(false);
    }
    // Unfolding gives back the original.
    expect(folded.replace(/\r\n /g, '')).toBe(line);
  });
});

describe('buildIcs', () => {
  it('emits one VEVENT per booking with CRLF endings', () => {
    const ics = buildIcs('יומן', [
      {
        uid: 'abc@herbalist',
        start: new Date('2026-09-10T07:30:00Z'),
        end: new Date('2026-09-10T08:30:00Z'),
        summary: 'דנה כהן · דיקור',
        location: 'חדר 1',
      },
    ]);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('UID:abc@herbalist');
    expect(ics).toContain('DTSTART:20260910T073000Z');
    expect(ics).toContain('SUMMARY:דנה כהן · דיקור');
    expect(ics).toContain('LOCATION:חדר 1');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.split('BEGIN:VEVENT')).toHaveLength(2);
  });
});
