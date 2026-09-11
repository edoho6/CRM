import { z } from 'zod';
import { INVITABLE_ROLES, MEMBERSHIP_ROLES } from '../enums';
import { optionalText, uuidField } from './common';

/**
 * The team screen's three writes: an invitation, a member's role, a member's
 * standing. The clinic is never in the payload — it comes from the session —
 * and the database refuses the two moves an owner must not make on their
 * own row.
 */

export const invitationSchema = z.object({
  role: z.enum(INVITABLE_ROLES),
  inviteeName: optionalText(80),
});
export type InvitationInput = z.input<typeof invitationSchema>;

export const membershipRoleSchema = z.object({
  membershipId: uuidField,
  role: z.enum(MEMBERSHIP_ROLES),
});

export const membershipActiveSchema = z.object({
  membershipId: uuidField,
  active: z.boolean(),
});
