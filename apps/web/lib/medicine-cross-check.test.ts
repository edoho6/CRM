import { describe, expect, it } from 'vitest';
import { crossCheck, mentions, normalizeName, statusFor } from '../../../scripts/medicine/lib/cross-check.mjs';
import { candidateNames, cleanName } from '../../../scripts/medicine/lib/drug-names.mjs';

describe('drug names for the American sources', () => {
  it('drops the chemist prefixes and keeps the name', () => {
    expect(cleanName('rac-warfarin')).toBe('warfarin');
    expect(cleanName('(RS)-metoprolol')).toBe('metoprolol');
    expect(cleanName('levothyroxine (T4)')).toBe('levothyroxine');
  });

  it('tries the plain names before codes and formulas, and the American spelling first', () => {
    const record = {
      labels: { en: 'cytophosphane' },
      aliases: { en: ['bis phosphoramide cyclic propanolamide ester', 'CPA-1', 'anhydrous cyclophosphamide', 'cyclophosphamide'] },
    };
    const names = candidateNames(record);
    expect(names.slice(0, 3)).toEqual(['cytophosphane', 'cyclophosphamide', 'anhydrous cyclophosphamide']);
    expect(candidateNames({ labels: { en: 'paracetamol' }, aliases: { en: [] } })).toEqual(['acetaminophen', 'paracetamol']);
    expect(candidateNames({ labels: { en: 'rac-salbutamol' }, aliases: { en: ['(±)-salbutamol'] } }, 'salbutamol').slice(0, 2)).toEqual(['albuterol', 'salbutamol']);
  });
});

/**
 * The part of the medicine pipeline that decides how far an entry has been
 * checked. It runs under Node with no network, so it is tested here with the
 * rest of the pure modules.
 */
describe('medicine cross-check', () => {
  it('finds names as whole words only, and ignores names too short to be safe', () => {
    const text = 'Symptoms include fever, a dry cough and fatigue. Fluid intake matters; the flu is common.';
    expect(mentions(text, ['fever', 'cough', 'fatigue', 'flu', 'nausea'])).toEqual(['fever', 'cough', 'fatigue']);
    // "flu" is inside "fluid" and shorter than four letters: never counted, even where it does appear.
    expect(mentions('the flu', ['flu'])).toEqual([]);
  });

  it('matches names regardless of case and punctuation', () => {
    expect(normalizeName('Type 2 Diabetes-Mellitus')).toBe('type 2 diabetes mellitus');
    expect(mentions('indicated for TYPE 2 DIABETES mellitus', ['type 2 diabetes'])).toEqual(['type 2 diabetes']);
  });

  it('counts a claim as agreed only when two sources make it', () => {
    const check = crossCheck({
      sources: ['wikidata', 'fda'],
      evidence: {
        treats: { wikidata: ['type 2 diabetes', 'obesity'], fda: ['Type 2 Diabetes'] },
        side_effect: { fda: ['nausea'] },
      },
    });
    expect(check.sources).toBe(2);
    expect(check.agree).toEqual(['treats:type 2 diabetes']);
    expect(check.conflicts).toEqual([]);
    expect(statusFor(check)).toBe('cross_checked');
  });

  it('keeps an entry a draft with one source, or with two that never agree', () => {
    expect(statusFor(crossCheck({ sources: ['wikidata'], evidence: { treats: { wikidata: ['hypertension'] } } }))).toBe('draft');
    expect(
      statusFor(crossCheck({ sources: ['wikidata', 'medlineplus'], evidence: { symptom: { wikidata: ['headache'], medlineplus: ['fever'] } } })),
    ).toBe('draft');
  });

  it('counts the same source once, however many times it contributed', () => {
    expect(crossCheck({ sources: ['fda', 'fda', 'wikidata'], evidence: {} }).sources).toBe(2);
  });
});
