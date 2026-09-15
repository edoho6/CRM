import { describe, expect, it } from 'vitest';
import { catalogueSources, localizedField } from '@clinic/domain';

describe('localizedField', () => {
  const row = {
    functions: '• מחזק צ׳י',
    indications: '',
    text_en: { functions: '• Tonifies Qi', indications: '' },
  };
  it('gives the Hebrew in Hebrew and the English in English', () => {
    expect(localizedField(row, 'functions', 'he')).toBe('• מחזק צ׳י');
    expect(localizedField(row, 'functions', 'en')).toBe('• Tonifies Qi');
  });
  it('falls back to the Hebrew when the English is missing, and to null when both are empty', () => {
    expect(localizedField({ ...row, text_en: null }, 'functions', 'en')).toBe('• מחזק צ׳י');
    expect(localizedField({ ...row, text_en: {} }, 'functions', 'en')).toBe('• מחזק צ׳י');
    expect(localizedField(row, 'indications', 'en')).toBeNull();
    expect(localizedField(row, 'indications', 'he')).toBeNull();
  });
});

describe('catalogueSources', () => {
  it('keeps only well-formed references', () => {
    expect(
      catalogueSources({
        sources: [
          { name: 'bara', url: 'https://barapro.co.il/x', title: 'Huang Qi' },
          { name: 'americandragon', url: 'https://www.americandragon.com/y' },
          { name: 'bad', url: 'javascript:alert(1)' },
          'nonsense',
          null,
        ],
      }),
    ).toEqual([
      { name: 'bara', url: 'https://barapro.co.il/x', title: 'Huang Qi' },
      { name: 'americandragon', url: 'https://www.americandragon.com/y' },
    ]);
    expect(catalogueSources({ sources: null })).toEqual([]);
    expect(catalogueSources({})).toEqual([]);
  });
});
