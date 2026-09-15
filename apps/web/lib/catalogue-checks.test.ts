import { describe, expect, it } from 'vitest';
import {
  factNumbers,
  numbersIn,
  removeUnits,
  sharedRuns,
  unitMatches,
  units,
  unitsWithSharedRuns,
  unitsWithUnsupportedNumbers,
  unsupportedNumbers,
} from '@catalogue/checks.ts';

describe('numbers', () => {
  it('reads every number in a text, decimals with a dot', () => {
    expect(numbersIn('3-9 גרם, 0,5 עד 1.5 צון')).toEqual(['3', '9', '0.5', '1.5']);
  });
  it('allows what the sheet has and flags the rest', () => {
    const allowed = factNumbers({ dose: { min: 3, max: 9 }, needling: [{ text: '0.5 to 1 cun' }] });
    expect(unsupportedNumbers('• 3–9 גרם ליום\n• דיקור 0.5 עד 1 צון', allowed)).toEqual([]);
    expect(unsupportedNumbers('• עד 15 גרם', allowed)).toEqual(['15']);
    expect(unitsWithUnsupportedNumbers('• 3–9 גרם ליום\n• עד 15 גרם ביום', allowed)).toEqual([
      '• עד 15 גרם ביום',
    ]);
  });
});

describe('units', () => {
  it('treats bullet lines as units and splits prose at sentence ends', () => {
    expect(units('• one\n• two\nThree here. Four there; five.')).toEqual([
      '• one',
      '• two',
      'Three here.',
      'Four there;',
      'five.',
    ]);
  });
  it('matches a unit to a quote loosely enough for a judge that trimmed punctuation', () => {
    expect(unitMatches('• מחזק את הטחול — עייפות, שלשול', 'מחזק את הטחול — עייפות, שלשול')).toBe(
      true,
    );
    expect(
      unitMatches(
        '• Tonifies the Spleen Qi and raises the Yang for prolapse',
        'Tonifies the Spleen Qi and raises the Yang',
      ),
    ).toBe(true);
    expect(unitMatches('• Tonifies Qi', 'Nourishes Blood')).toBe(false);
  });
  it('removes the failing units and keeps the rest, counting what went', () => {
    const text = '• Tonifies Qi\n• Cures everything\n• Raises the Yang';
    expect(removeUnits(text, ['Cures everything'])).toEqual({
      text: '• Tonifies Qi\n• Raises the Yang',
      removed: 1,
    });
    expect(removeUnits('One. Two invented. Three.', ['Two invented.'])).toEqual({
      text: 'One. Three.',
      removed: 1,
    });
    expect(removeUnits(text, [])).toEqual({ text, removed: 0 });
  });
});

describe('copying', () => {
  const source =
    'Opens the Lungs, spreads Lung Qi, expels Phlegm and benefits the throat for cough due to Wind-Cold';
  it('finds a run of seven words lifted from a source', () => {
    expect(
      sharedRuns('• It opens the lungs, spreads lung qi, expels phlegm and benefits the throat', [
        source,
      ]).length,
    ).toBeGreaterThan(0);
    expect(sharedRuns('• Disperses Lung Qi and clears Phlegm; eases the throat', [source])).toEqual(
      [],
    );
  });
  it('names the units that copy', () => {
    const text =
      '• Opens the Lungs, spreads Lung Qi, expels Phlegm and benefits the throat\n• Expels pus';
    expect(unitsWithSharedRuns(text, [source])).toEqual([
      '• Opens the Lungs, spreads Lung Qi, expels Phlegm and benefits the throat',
    ]);
  });
});
