import { describe, expect, it } from 'vitest';
import { clinicTaskSchema } from '@clinic/domain';

/**
 * The dashboard's one-line add sends exactly this shape. It is the only place
 * a task is created without the full dialog, so the schema has to accept the
 * blanks the dialog would otherwise fill in.
 */
describe('quick add from the dashboard', () => {
  it('accepts a title with everything else blank', () => {
    const result = clinicTaskSchema.safeParse({
      title: 'להתקשר למטופל',
      notes: '',
      due_on: '',
      is_urgent: false,
      patient_id: '',
    });
    expect(result.success, JSON.stringify(result.success ? null : result.error.issues)).toBe(true);
    if (result.success) {
      expect(result.data.due_on).toBeNull();
      expect(result.data.patient_id).toBeNull();
      expect(result.data.due_at).toBeNull();
      expect(result.data.remind_via).toBe('app');
    }
  });
});
