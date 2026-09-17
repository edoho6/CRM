/**
 * What each role in a clinic may do (decisions of 18.9).
 *
 * The database is where this is enforced — `sees_patient` and `sees_clinical`
 * in migration 78 — and nothing here can grant what a policy refuses. This map
 * exists so the interface agrees with the database: a screen a person may not
 * read should not be offered to them, because a menu that leads to an empty
 * page, or a button that always fails, is worse than no button at all.
 *
 * Keep the two in step. A capability added here without a policy behind it is a
 * screen that shows nothing; a policy without a capability is a locked door
 * with no sign on it.
 */

export type ClinicRole = 'owner' | 'practitioner' | 'staff' | 'assistant';

export interface Abilities {
  /** Patient files at all: names, contact details, the list. */
  patients: boolean;
  /** The treatment record, notes, prescriptions, documents, filled questionnaires, tags. */
  clinicalRecords: boolean;
  /** The diary. */
  calendar: boolean;
  /** Invoices and payments — the whole invoice, lines included. */
  money: boolean;
  /** Income reports and questions about the clinic's own data. */
  reports: boolean;
  /** The professional library. */
  library: boolean;
  /** The stock room and price comparison. */
  inventory: boolean;
  /** Reminders, messages and automations. */
  messages: boolean;
  /** Clinic settings, the team, and the access log. */
  settings: boolean;
  /** Removing a patient's file. Kept apart from editing on purpose. */
  deletePatient: boolean;
}

const NONE: Abilities = {
  patients: false,
  clinicalRecords: false,
  calendar: false,
  money: false,
  reports: false,
  library: false,
  inventory: false,
  messages: false,
  settings: false,
  deletePatient: false,
};

const BY_ROLE: Record<ClinicRole, Abilities> = {
  // Everything, and the only role that reaches the settings, the team, the
  // access log and the income reports.
  owner: {
    patients: true,
    clinicalRecords: true,
    calendar: true,
    money: true,
    reports: true,
    library: true,
    inventory: true,
    messages: true,
    settings: true,
    deletePatient: true,
  },
  // The clinical work, for their own patients — which patients those are is the
  // database's answer, not this map's.
  practitioner: {
    ...NONE,
    patients: true,
    clinicalRecords: true,
    calendar: true,
    money: true,
    library: true,
    inventory: true,
    messages: true,
  },
  // The front desk: the diary, contact details, invoices and reminders. She
  // sees that a treatment happened and when — never what was written in it.
  staff: {
    ...NONE,
    patients: true,
    calendar: true,
    money: true,
    messages: true,
  },
  // Defined and unused (decision of 18.9). It reaches nothing until a clinic
  // asks for it, and then this is the line to change.
  assistant: { ...NONE },
};

/**
 * A copy every time, not the stored object: a caller that edited what came back
 * would be editing the rule for everyone else in the process, and a permission
 * table is the last place to leave that open.
 */
export function abilitiesFor(role: string | null | undefined): Abilities {
  if (!role || !Object.prototype.hasOwnProperty.call(BY_ROLE, role)) return { ...NONE };
  return { ...BY_ROLE[role as ClinicRole] };
}

/** The roles, in the order a person would read them: most access first. */
export const CLINIC_ROLES: ClinicRole[] = ['owner', 'practitioner', 'staff', 'assistant'];

/** The capabilities, in the order the table on the team screen lists them. */
export const ABILITY_KEYS: (keyof Abilities)[] = [
  'patients',
  'clinicalRecords',
  'calendar',
  'money',
  'messages',
  'inventory',
  'library',
  'reports',
  'settings',
  'deletePatient',
];
