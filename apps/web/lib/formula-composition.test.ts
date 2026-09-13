import { describe, expect, it } from 'vitest';
import { pieArcs, tasteComposition, temperatureComposition, type CompositionHerb } from '@clinic/domain';

const herb = (temperature: CompositionHerb['temperature'], tastes: CompositionHerb['tastes'] = []): CompositionHerb => ({ temperature, tastes });

describe('temperatureComposition', () => {
  it('counts each nature and reads the lean from the larger side', () => {
    const herbs = [herb('warm'), herb('warm'), herb('hot'), ...Array.from({ length: 7 }, () => herb('cool'))];
    const composition = temperatureComposition(herbs);
    expect(composition.slices.map((slice) => [slice.key, slice.count])).toEqual([
      ['hot', 1],
      ['warm', 2],
      ['cool', 7],
    ]);
    expect(composition.warm).toBe(3);
    expect(composition.cool).toBe(7);
    expect(composition.lean).toBe('cool');
    expect(composition.slices[2]!.share).toBeCloseTo(0.7);
  });

  it('calls a tie balanced, and nothing known unknown', () => {
    expect(temperatureComposition([herb('warm'), herb('cold'), herb('neutral')]).lean).toBe('balanced');
    expect(temperatureComposition([herb(null), null, undefined]).lean).toBe('unknown');
  });

  it('keeps herbs without a recorded nature apart', () => {
    const composition = temperatureComposition([herb('warm'), herb(null)]);
    expect(composition.unknown).toBe(1);
    expect(composition.known).toBe(1);
    expect(composition.slices[0]!.share).toBe(1);
  });
});

describe('tasteComposition', () => {
  it('counts a herb once per taste, in the fixed order of tastes', () => {
    const composition = tasteComposition([herb('warm', ['acrid', 'sweet']), herb('cool', ['sweet']), herb('cool', ['bitter', 'bitter']), herb('cool', [])]);
    expect(composition.slices.map((slice) => [slice.key, slice.count])).toEqual([
      ['sweet', 2],
      ['bitter', 1],
      ['acrid', 1],
    ]);
    expect(composition.mentions).toBe(4);
    expect(composition.unknown).toBe(1);
  });
});

describe('pieArcs', () => {
  it('draws one wedge per slice, together a whole circle', () => {
    const arcs = pieArcs(
      [
        { key: 'a', count: 1, share: 0.25 },
        { key: 'b', count: 3, share: 0.75 },
      ],
      40,
    );
    expect(arcs).toHaveLength(2);
    expect(arcs[0]!.d).toMatch(/^M 40 40 L 40 0 A 40 40 0 0 1 80 40 Z$/);
    // The larger wedge takes the long way round.
    expect(arcs[1]!.d).toContain('A 40 40 0 1 1');
  });

  it('draws a single slice as a ring', () => {
    const [arc] = pieArcs([{ key: 'only', count: 2, share: 1 }], 40, 20);
    expect(arc!.d.match(/A /g)).toHaveLength(4);
  });

  it('draws nothing for nothing', () => {
    expect(pieArcs([], 40)).toEqual([]);
  });
});
