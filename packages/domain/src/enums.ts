/**
 * Domain enums shared by both apps and mirrored by Postgres CHECK constraints.
 *
 * Every list here has an exact counterpart in `supabase/migrations`. When you add a
 * value, add it to the matching CHECK constraint in a new migration too, otherwise
 * inserts will be rejected by the database.
 *
 * Each enum is declared as a readonly tuple so it can be (a) iterated in the UI to
 * build dropdowns, and (b) passed straight to `z.enum()` for validation.
 */

export const LOCALES = ['he', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'he';

/** Staff roles inside a clinic. Milestone 1 only ever creates `owner`. */
export const MEMBERSHIP_ROLES = ['owner', 'practitioner', 'staff', 'assistant'] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const SEXES = ['female', 'male', 'other', 'unspecified'] as const;
export type Sex = (typeof SEXES)[number];

export const APPOINTMENT_STATUSES = [
  'scheduled',
  'confirmed',
  'checked_in',
  'completed',
  'cancelled',
  'no_show',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** Statuses that still occupy a slot in the calendar (used by the overlap constraint). */
export const BLOCKING_APPOINTMENT_STATUSES = APPOINTMENT_STATUSES.filter(
  (status) => status !== 'cancelled',
);

export const ENCOUNTER_STATUSES = ['draft', 'signed'] as const;
export type EncounterStatus = (typeof ENCOUNTER_STATUSES)[number];

export const DOCUMENT_CATEGORIES = ['intake_form', 'lab_result', 'id_scan', 'other'] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

/** Treatment modalities used in a TCM session. */
export const TREATMENT_MODALITIES = [
  'acupuncture',
  'electro_acupuncture',
  'moxibustion',
  'cupping',
  'gua_sha',
  'tuina',
  'auricular',
  'herbal_formula',
  'dietary_advice',
] as const;
export type TreatmentModality = (typeof TREATMENT_MODALITIES)[number];

/** Needle technique applied at a point. */
export const NEEDLE_TECHNIQUES = ['even', 'tonifying', 'reducing', 'bleeding'] as const;
export type NeedleTechnique = (typeof NEEDLE_TECHNIQUES)[number];

export const POINT_SIDES = ['left', 'right', 'bilateral', 'midline'] as const;
export type PointSide = (typeof POINT_SIDES)[number];

/** Physical form the herb is stocked in. */
export const HERB_CATEGORIES = [
  'raw_herb',
  'granule',
  'powder',
  'pill',
  'tincture',
  'patent_formula_product',
  'external_application',
] as const;
export type HerbCategory = (typeof HERB_CATEGORIES)[number];

export const HERB_UNITS = ['gram', 'capsule', 'bottle', 'box', 'milliliter', 'packet'] as const;
export type HerbUnit = (typeof HERB_UNITS)[number];

export const FORMULA_CATEGORIES = ['classical', 'modified', 'custom'] as const;
export type FormulaCategory = (typeof FORMULA_CATEGORIES)[number];

/**
 * Stock ledger entry types. `receive` and `return` add stock (positive quantity),
 * `dispense`, `waste` add negative quantity, `adjustment` can be either.
 */
export const STOCK_MOVEMENT_TYPES = [
  'receive',
  'dispense',
  'adjustment',
  'waste',
  'return',
] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export const PURCHASE_ORDER_STATUSES = ['draft', 'ordered', 'received', 'cancelled'] as const;
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

export const DISPENSING_STATUSES = ['dispensed', 'partially_returned', 'returned'] as const;
export type DispensingStatus = (typeof DISPENSING_STATUSES)[number];

export const AUDIT_ACTIONS = ['insert', 'update', 'delete', 'sign'] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
