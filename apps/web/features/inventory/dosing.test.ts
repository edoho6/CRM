import { describe, expect, it } from 'vitest';
import {
  GRANULE_RATIO,
  dailyDose,
  prescriptionTotal,
  granulesToRaw,
  multiplierForTotal,
  rawToGranules,
  round2,
  splitByParts,
} from './dosing';

describe('granule conversion', () => {
  it('converts raw herb to granules at the stated ratio', () => {
    expect(rawToGranules(100)).toBe(20);
    expect(rawToGranules(9)).toBe(1.8);
  });

  it('converts back the other way', () => {
    expect(granulesToRaw(20)).toBe(100);
    expect(granulesToRaw(1.8)).toBe(9);
  });

  it('round-trips', () => {
    for (const grams of [1, 7, 13.5, 250]) {
      expect(granulesToRaw(rawToGranules(grams))).toBeCloseTo(grams, 1);
    }
  });

  it('uses the ratio the interface states', () => {
    expect(rawToGranules(GRANULE_RATIO)).toBe(1);
  });
});

describe('splitByParts', () => {
  it('splits a total in proportion to the parts', () => {
    // The practitioner's own example: nine herbs out of 100g, three each at
    // 13, 19 and 6. Total parts 114.
    const lines = [
      ...Array.from({ length: 3 }, (_, i) => ({ item: `a${i}`, dose: 13 })),
      ...Array.from({ length: 3 }, (_, i) => ({ item: `b${i}`, dose: 19 })),
      ...Array.from({ length: 3 }, (_, i) => ({ item: `c${i}`, dose: 6 })),
    ];

    const result = splitByParts(lines, 100);

    expect(result).toHaveLength(9);
    expect(result[0]!.quantity).toBe(11.4); // 13/114 * 100
    expect(result[3]!.quantity).toBe(16.67); // 19/114 * 100
    expect(result[6]!.quantity).toBe(5.26); // 6/114 * 100
  });

  it('adds up to the total, within rounding', () => {
    const lines = [
      { item: 'a', dose: 13 },
      { item: 'b', dose: 19 },
      { item: 'c', dose: 6 },
    ];
    const sum = splitByParts(lines, 100).reduce((total, line) => total + line.quantity, 0);
    expect(sum).toBeGreaterThan(99.9);
    expect(sum).toBeLessThan(100.1);
  });

  it('treats the numbers as grams when no total is given', () => {
    const lines = [
      { item: 'a', dose: 9 },
      { item: 'b', dose: 12 },
    ];
    expect(splitByParts(lines, null)).toEqual([
      { item: 'a', quantity: 9 },
      { item: 'b', quantity: 12 },
    ]);
  });

  it('ignores lines with no amount rather than dividing by them', () => {
    const lines = [
      { item: 'a', dose: 10 },
      { item: 'b', dose: 0 },
      { item: 'c', dose: 10 },
    ];
    const result = splitByParts(lines, 100);
    expect(result).toHaveLength(2);
    expect(result[0]!.quantity).toBe(50);
  });

  it('returns nothing rather than dividing by zero', () => {
    expect(splitByParts([{ item: 'a', dose: 0 }], 100)).toEqual([]);
    expect(splitByParts([], 100)).toEqual([]);
  });

  it('handles a single herb taking the whole total', () => {
    expect(splitByParts([{ item: 'a', dose: 7 }], 90)).toEqual([{ item: 'a', quantity: 90 }]);
  });

  it('scales equally when every part is the same', () => {
    const lines = ['a', 'b', 'c', 'd'].map((item) => ({ item, dose: 5 }));
    for (const line of splitByParts(lines, 60)) {
      expect(line.quantity).toBe(15);
    }
  });
});

describe('multiplierForTotal', () => {
  it('is the requested total over the written dose', () => {
    expect(multiplierForTotal(50, 100)).toBe(2);
    expect(multiplierForTotal(114, 57)).toBe(0.5);
  });

  it('is 1 when no total is asked for', () => {
    expect(multiplierForTotal(50, null)).toBe(1);
    expect(multiplierForTotal(50, 0)).toBe(1);
  });

  it('refuses to divide by an empty formula', () => {
    expect(multiplierForTotal(0, 100)).toBe(1);
  });
});

describe('round2', () => {
  it('clears the floating-point tail', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(11.399999999)).toBe(11.4);
  });
});

describe('dailyDose', () => {
  it('multiplies the dose by how often it is taken', () => {
    expect(dailyDose({ dose_amount: 3, doses_per_day: 2, dose_unit: 'gram' }, 'gram')).toEqual({
      amount: 6,
      unit: 'gram',
    });
  });

  it('reads the numbers a numeric column sends as strings', () => {
    expect(
      dailyDose({ dose_amount: '4.5', doses_per_day: '2', dose_unit: 'gram' }, 'gram'),
    ).toEqual({ amount: 9, unit: 'gram' });
  });

  it('rounds to two places rather than showing the floating-point tail', () => {
    expect(dailyDose({ dose_amount: 0.1, doses_per_day: 3, dose_unit: 'gram' }, 'gram')).toEqual({
      amount: 0.3,
      unit: 'gram',
    });
  });

  it('says nothing when either half is missing', () => {
    expect(
      dailyDose({ dose_amount: 3, doses_per_day: null, dose_unit: 'gram' }, 'gram'),
    ).toBeNull();
    expect(
      dailyDose({ dose_amount: null, doses_per_day: 2, dose_unit: 'gram' }, 'gram'),
    ).toBeNull();
    expect(dailyDose({ dose_amount: 0, doses_per_day: 2, dose_unit: 'gram' }, 'gram')).toBeNull();
  });

  it('falls back to the unit it is given when the row carries none', () => {
    expect(dailyDose({ dose_amount: 2, doses_per_day: 2, dose_unit: null }, 'gram')).toEqual({
      amount: 4,
      unit: 'gram',
    });
  });
});

describe('prescriptionTotal', () => {
  it('adds the lines up', () => {
    expect(prescriptionTotal([{ quantity: 9 }, { quantity: 6 }, { quantity: 12 }])).toBe(27);
  });

  it('adds strings from a numeric column', () => {
    expect(prescriptionTotal([{ quantity: '9.5' }, { quantity: '6.25' }])).toBe(15.75);
  });

  it('treats a missing weight as nothing rather than as NaN', () => {
    expect(prescriptionTotal([{ quantity: 9 }, { quantity: null }])).toBe(9);
  });

  it('is zero for an empty prescription', () => {
    expect(prescriptionTotal([])).toBe(0);
  });
});
