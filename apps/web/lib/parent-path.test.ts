import { describe, expect, it } from 'vitest';
import { parentPath } from './parent-path';

describe('parentPath', () => {
  it('has nowhere to go from the dashboard', () => {
    expect(parentPath('/')).toBeNull();
  });

  it('takes a top-level list to the dashboard', () => {
    expect(parentPath('/patients')).toBe('/');
    expect(parentPath('/calendar')).toBe('/');
    expect(parentPath('/settings')).toBe('/');
  });

  it('takes a record to its list', () => {
    expect(parentPath('/patients/abc-123')).toBe('/patients');
    // The treatments list is the diary's list view now.
    expect(parentPath('/encounters/abc-123')).toBe('/calendar?view=list');
    expect(parentPath('/billing/abc-123')).toBe('/billing');
  });

  it('takes an edit form to the record it edits', () => {
    expect(parentPath('/patients/abc-123/edit')).toBe('/patients/abc-123');
    expect(parentPath('/reference/herbs/abc-123/edit')).toBe('/reference/herbs/abc-123');
  });

  /* The whole reason this is not `history.back()`: a formula reached from a
     treatment goes up to the formula list, and from there to the dashboard —
     two presses, not back into the treatment. */
  it('takes a catalogue entry to its catalogue, and the catalogue home', () => {
    expect(parentPath('/reference/formulas/abc-123')).toBe('/reference/formulas');
    expect(parentPath('/reference/formulas')).toBe('/');
    expect(parentPath('/reference/herbs')).toBe('/');
    expect(parentPath('/reference/points')).toBe('/');
  });

  it('never lands on a path that only redirects', () => {
    expect(parentPath('/reference/compare')).toBe('/');
    expect(parentPath('/reference')).toBe('/');
  });

  it('keeps deeper sections in their section', () => {
    expect(parentPath('/inventory/batches/receive')).toBe('/inventory/batches');
    expect(parentPath('/inventory/batches')).toBe('/inventory');
    expect(parentPath('/settings/team')).toBe('/settings');
    expect(parentPath('/library/sources')).toBe('/library');
  });

  it('ignores a trailing slash', () => {
    expect(parentPath('/patients/')).toBe('/');
    expect(parentPath('/reference/formulas/abc-123/')).toBe('/reference/formulas');
  });
});
