import { describe, expect, it } from 'vitest';
import {
  ABILITY_KEYS,
  CLINIC_ROLES,
  INVITABLE_ROLES,
  MEMBERSHIP_ROLES,
  abilitiesFor,
  invitationSchema,
  membershipRoleSchema,
  type Abilities,
} from '@clinic/domain';

/**
 * These read like the decisions they came from (18.9), on purpose: when someone
 * changes who sees what, the failing test should name the promise that broke
 * rather than an index into a table.
 */

describe('abilitiesFor', () => {
  it('gives the owner everything', () => {
    const owner = abilitiesFor('owner');
    for (const key of ABILITY_KEYS) {
      expect(owner[key], `owner should have ${key}`).toBe(true);
    }
  });

  it('lets a practitioner into the records but not the settings', () => {
    const practitioner = abilitiesFor('practitioner');
    expect(practitioner.clinicalRecords).toBe(true);
    expect(practitioner.library).toBe(true);
    expect(practitioner.settings).toBe(false);
    expect(practitioner.reports).toBe(false);
    expect(practitioner.deletePatient).toBe(false);
  });

  it('keeps the secretary out of the clinical record and in the money', () => {
    const staff = abilitiesFor('staff');
    expect(staff.patients).toBe(true);
    expect(staff.calendar).toBe(true);
    expect(staff.money).toBe(true);
    expect(staff.messages).toBe(true);
    expect(staff.clinicalRecords).toBe(false);
    expect(staff.library).toBe(false);
    expect(staff.reports).toBe(false);
    expect(staff.deletePatient).toBe(false);
  });

  it('knows three roles, and the removed one reaches nothing', () => {
    expect(CLINIC_ROLES).toEqual(['owner', 'practitioner', 'staff']);
    expect(INVITABLE_ROLES).toEqual(['practitioner', 'staff']);
    expect(MEMBERSHIP_ROLES).not.toContain('assistant');
    const removed = abilitiesFor('assistant');
    for (const key of ABILITY_KEYS) {
      expect(removed[key], `the removed role should not have ${key}`).toBe(false);
    }
  });

  it('refuses the removed role in an invitation and a role change', () => {
    expect(invitationSchema.safeParse({ role: 'assistant' }).success).toBe(false);
    expect(
      membershipRoleSchema.safeParse({
        membershipId: '7d1f4b1e-4a4e-4c55-9d4a-1f2e3d4c5b6a',
        role: 'assistant',
      }).success,
    ).toBe(false);
    expect(
      membershipRoleSchema.safeParse({
        membershipId: '7d1f4b1e-4a4e-4c55-9d4a-1f2e3d4c5b6a',
        role: 'staff',
      }).success,
    ).toBe(true);
  });

  it('treats an unknown or missing role as no access, never as full access', () => {
    for (const role of [null, undefined, '', 'admin', 'OWNER']) {
      const abilities = abilitiesFor(role);
      for (const key of ABILITY_KEYS) {
        expect(abilities[key], `${String(role)} should not have ${key}`).toBe(false);
      }
    }
  });

  it('never lets a narrower role reach past the owner', () => {
    const owner = abilitiesFor('owner');
    for (const role of CLINIC_ROLES) {
      const abilities = abilitiesFor(role);
      for (const key of ABILITY_KEYS) {
        if (abilities[key]) expect(owner[key], `${role}.${key} beyond the owner`).toBe(true);
      }
    }
  });

  it('lists every capability in the table shown on the team screen', () => {
    const owner = abilitiesFor('owner') as Abilities;
    expect([...ABILITY_KEYS].sort()).toEqual((Object.keys(owner) as (keyof Abilities)[]).sort());
  });

  it('hands back a copy, so a caller cannot edit the rule for everyone else', () => {
    const first = abilitiesFor('staff');
    first.clinicalRecords = true;
    expect(abilitiesFor('staff').clinicalRecords).toBe(false);
  });
});
