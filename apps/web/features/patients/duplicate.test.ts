import { describe, expect, it } from 'vitest';
import { findDuplicate, nationalIdKey, phoneKey } from './duplicate';

const patient = (
  id: string,
  full_name: string | null,
  phone: string | null,
  national_id: string | null = null,
) => ({ id, full_name, phone, national_id });

describe('phoneKey', () => {
  it('reads one number written three ways as one number', () => {
    expect(phoneKey('050-123-4567')).toBe(phoneKey('0501234567'));
    expect(phoneKey('+972501234567')).toBe(phoneKey('0501234567'));
    expect(phoneKey('972-50-123-4567')).toBe(phoneKey('050 123 4567'));
  });

  it('refuses to match on too few digits', () => {
    expect(phoneKey('1234')).toBeNull();
    expect(phoneKey('')).toBeNull();
    expect(phoneKey(null)).toBeNull();
  });

  it('keeps two different numbers different', () => {
    expect(phoneKey('0501234567')).not.toBe(phoneKey('0501234568'));
  });
});

describe('nationalIdKey', () => {
  it('ignores punctuation', () => {
    expect(nationalIdKey('123-456-782')).toBe('123456782');
  });

  it('refuses a fragment', () => {
    expect(nationalIdKey('12')).toBeNull();
    expect(nationalIdKey(null)).toBeNull();
  });
});

describe('findDuplicate', () => {
  const existing = [
    patient('a', 'דנה לוי', '050-123-4567', '123456782'),
    patient('b', 'יוסי כהן', '052-000-1111', null),
  ];

  it('finds the same phone written differently', () => {
    expect(findDuplicate(existing, { phone: '+972501234567' })).toEqual({
      id: 'a',
      name: 'דנה לוי',
      on: 'phone',
    });
  });

  it('finds the same national ID', () => {
    expect(findDuplicate(existing, { national_id: '123456782' })).toEqual({
      id: 'a',
      name: 'דנה לוי',
      on: 'national_id',
    });
  });

  it('prefers the ID when the two point at different people', () => {
    const candidates = [
      patient('a', 'דנה לוי', '050-123-4567', '111111111'),
      patient('b', 'יוסי כהן', '052-000-1111', '222222222'),
    ];
    const match = findDuplicate(candidates, { phone: '050-123-4567', national_id: '222222222' });
    // A phone is shared by a household; an ID is one person.
    expect(match).toEqual({ id: 'b', name: 'יוסי כהן', on: 'national_id' });
  });

  it('says nothing when neither identifier was given', () => {
    expect(findDuplicate(existing, { phone: '', national_id: null })).toBeNull();
  });

  it('says nothing when nothing matches', () => {
    expect(findDuplicate(existing, { phone: '054-999-8888' })).toBeNull();
  });

  it('does not report a patient as their own duplicate', () => {
    expect(findDuplicate(existing, { phone: '050-123-4567' }, 'a')).toBeNull();
  });

  it('still reports a collision with somebody else while editing', () => {
    expect(findDuplicate(existing, { phone: '052-000-1111' }, 'a')).toEqual({
      id: 'b',
      name: 'יוסי כהן',
      on: 'phone',
    });
  });

  it('is not fooled by a short number that happens to end the same way', () => {
    expect(findDuplicate(existing, { phone: '4567' })).toBeNull();
  });
});
