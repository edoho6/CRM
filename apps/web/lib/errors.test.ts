import { describe, expect, it } from 'vitest';
import { mapDatabaseError, PASS_THROUGH_CODES } from './errors';

describe('mapDatabaseError', () => {
  it('carries an action code through by name, so the screen that knows it can say so', () => {
    // These all became "server error" before, and the assistant's own messages
    // ("today's questions are used up") were never shown.
    for (const code of PASS_THROUGH_CODES) {
      const { key } = mapDatabaseError(new Error(code));
      expect(key).toBe(`errors.${code}`);
      expect(key.endsWith(code)).toBe(true);
    }
  });

  it('still hides anything it does not know behind the general message', () => {
    expect(mapDatabaseError(new Error('relation "x" does not exist')).key).toBe(
      'errors.serverError',
    );
    expect(mapDatabaseError(new Error('assistant_quota and more')).key).toBe('errors.serverError');
  });
});
