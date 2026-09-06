import type {
  AppointmentStatus,
  AuditAction,
  DispensingStatus,
  DocumentCategory,
  EncounterStatus,
  FormulaCategory,
  HerbCategory,
  HerbUnit,
  Locale,
  MembershipRole,
  NeedleTechnique,
  PointSide,
  PurchaseOrderStatus,
  Sex,
  StockMovementType,
  TreatmentModality,
} from '@clinic/domain';

/**
 * Row shapes for the Milestone 1 schema, kept in step with `supabase/migrations`.
 *
 * These are hand-written so the app is fully typed before a Supabase project exists.
 * Once the database is live, `pnpm db:types` regenerates the canonical definitions
 * straight from Postgres — treat that output as the source of truth from then on.
 */

export interface Clinic {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  default_locale: Locale;
  address: string | null;
  phone: string | null;
  email: string | null;
  tax_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  preferred_locale: Locale;
  avatar_url: string | null;
  title: string | null;
  license_number: string | null;
  created_at: string;
  updated_at: string;
}

export interface Membership {
  id: string;
  clinic_id: string;
  user_id: string;
  role: MembershipRole;
  is_active: boolean;
  created_at: string;
}

/** Membership joined with its clinic and profile — what the app shell needs on every page. */
export interface MembershipContext {
  membership: Membership;
  clinic: Clinic;
  profile: Profile | null;
}

export interface Patient {
  id: string;
  clinic_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  date_of_birth: string | null;
  sex: Sex;
  national_id: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  occupation: string | null;
  referral_source: string | null;
  preferred_locale: Locale;
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PatientMedicalHistory {
  id: string;
  clinic_id: string;
  patient_id: string;
  allergies: string | null;
  medications: string | null;
  chronic_conditions: string | null;
  surgeries: string | null;
  family_history: string | null;
  lifestyle_notes: string | null;
  pregnancy_status: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PatientDocument {
  id: string;
  clinic_id: string;
  patient_id: string;
  uploaded_by: string | null;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  category: DocumentCategory;
  shared_with_patient: boolean;
  created_at: string;
}

export interface AppointmentType {
  id: string;
  clinic_id: string;
  name_he: string;
  name_en: string;
  default_duration_minutes: number;
  color: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Appointment {
  id: string;
  clinic_id: string;
  patient_id: string;
  practitioner_id: string;
  appointment_type_id: string | null;
  start_at: string;
  end_at: string;
  status: AppointmentStatus;
  location: string | null;
  notes: string | null;
  cancelled_reason: string | null;
  cancelled_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Appointment plus the labels the calendar and lists need, avoiding N+1 lookups. */
export interface AppointmentWithRelations extends Appointment {
  patient: Pick<Patient, 'id' | 'first_name' | 'last_name' | 'full_name' | 'phone'> | null;
  appointment_type: Pick<AppointmentType, 'id' | 'name_he' | 'name_en' | 'color'> | null;
  practitioner: Pick<Profile, 'id' | 'full_name'> | null;
  encounter_id?: string | null;
}

export interface PractitionerSchedule {
  id: string;
  clinic_id: string;
  practitioner_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at: string;
}

export interface ScheduleException {
  id: string;
  clinic_id: string;
  practitioner_id: string;
  date: string;
  is_closed: boolean;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  created_at: string;
}

export interface Encounter {
  id: string;
  clinic_id: string;
  patient_id: string;
  appointment_id: string | null;
  practitioner_id: string;
  encounter_date: string;
  status: EncounterStatus;
  signed_at: string | null;
  signed_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** A point recorded in `tcm_notes.points_used`. */
export interface RecordedPoint {
  point: string;
  side: PointSide;
  technique: NeedleTechnique;
  retention_minutes?: number | null;
  notes?: string | null;
}

export interface TcmNote {
  id: string;
  clinic_id: string;
  encounter_id: string;
  chief_complaint: string | null;
  history_of_present_illness: string | null;
  tongue_body_color: string | null;
  tongue_shape: string | null;
  tongue_coating: string | null;
  tongue_notes: string | null;
  pulse_left: string | null;
  pulse_right: string | null;
  pulse_qualities: string[];
  pulse_notes: string | null;
  tcm_pattern_diagnosis: string | null;
  western_diagnosis: string | null;
  treatment_principle: string | null;
  modalities_used: TreatmentModality[];
  points_used: RecordedPoint[];
  treatment_notes: string | null;
  recommendations: string | null;
  follow_up_plan: string | null;
  created_at: string;
  updated_at: string;
}

export interface EncounterWithNote extends Encounter {
  note: TcmNote | null;
  patient: Pick<Patient, 'id' | 'first_name' | 'last_name' | 'full_name'> | null;
  practitioner: Pick<Profile, 'id' | 'full_name'> | null;
}

export interface AuditLogEntry {
  id: string;
  clinic_id: string;
  table_name: string;
  record_id: string;
  action: AuditAction;
  changed_by: string | null;
  changed_at: string;
  diff: Record<string, unknown> | null;
}

export interface Supplier {
  id: string;
  clinic_id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Herb {
  id: string;
  clinic_id: string;
  pinyin_name: string | null;
  chinese_name: string | null;
  english_name: string | null;
  hebrew_name: string | null;
  botanical_name: string | null;
  category: HerbCategory;
  default_unit: HerbUnit;
  properties: string | null;
  functions: string | null;
  cautions: string | null;
  reorder_threshold: number | null;
  reorder_quantity: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Herb enriched with its live stock position, from the `herb_stock_levels` view. */
export interface HerbStockLevel {
  herb_id: string;
  clinic_id: string;
  pinyin_name: string | null;
  chinese_name: string | null;
  english_name: string | null;
  hebrew_name: string | null;
  botanical_name: string | null;
  category: HerbCategory;
  default_unit: HerbUnit;
  reorder_threshold: number | null;
  reorder_quantity: number | null;
  is_active: boolean;
  total_remaining: number;
  batch_count: number;
  nearest_expiry: string | null;
  is_below_threshold: boolean;
}

export interface HerbFormula {
  id: string;
  clinic_id: string;
  name_pinyin: string | null;
  name_chinese: string | null;
  name_english: string | null;
  name_hebrew: string | null;
  category: FormulaCategory;
  description: string | null;
  indications: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HerbFormulaItem {
  id: string;
  clinic_id: string;
  formula_id: string;
  herb_id: string;
  dosage: number;
  unit: HerbUnit;
  sequence: number;
  notes: string | null;
}

export interface HerbFormulaItemWithHerb extends HerbFormulaItem {
  herb: Pick<Herb, 'id' | 'pinyin_name' | 'chinese_name' | 'english_name' | 'hebrew_name' | 'default_unit'> | null;
}

export interface HerbFormulaWithItems extends HerbFormula {
  items: HerbFormulaItemWithHerb[];
}

export interface HerbBatch {
  id: string;
  clinic_id: string;
  herb_id: string;
  supplier_id: string | null;
  batch_number: string | null;
  quantity_received: number;
  quantity_remaining: number;
  unit: HerbUnit;
  unit_cost: number | null;
  expiry_date: string | null;
  storage_location: string | null;
  received_date: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface HerbBatchWithHerb extends HerbBatch {
  herb: Pick<Herb, 'id' | 'pinyin_name' | 'english_name' | 'hebrew_name' | 'chinese_name'> | null;
  supplier: Pick<Supplier, 'id' | 'name'> | null;
}

export interface StockMovement {
  id: string;
  clinic_id: string;
  herb_id: string;
  batch_id: string | null;
  movement_type: StockMovementType;
  quantity: number;
  unit: HerbUnit;
  reference_table: string | null;
  reference_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface PurchaseOrder {
  id: string;
  clinic_id: string;
  supplier_id: string | null;
  order_date: string;
  status: PurchaseOrderStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItem {
  id: string;
  clinic_id: string;
  purchase_order_id: string;
  herb_id: string;
  quantity: number;
  unit: HerbUnit;
  unit_cost: number | null;
}

export interface DispensingRecord {
  id: string;
  clinic_id: string;
  encounter_id: string;
  patient_id: string;
  formula_id: string | null;
  multiplier: number;
  dispensed_by: string | null;
  dispensed_at: string;
  status: DispensingStatus;
  notes: string | null;
  total_cost: number | null;
  created_at: string;
}

export interface DispensingItem {
  id: string;
  clinic_id: string;
  dispensing_record_id: string;
  herb_id: string;
  batch_id: string | null;
  quantity: number;
  unit: HerbUnit;
  unit_cost_snapshot: number | null;
  line_total: number | null;
}

export interface DispensingItemWithHerb extends DispensingItem {
  herb: Pick<Herb, 'id' | 'pinyin_name' | 'english_name' | 'hebrew_name' | 'chinese_name'> | null;
}

export interface DispensingRecordWithItems extends DispensingRecord {
  items: DispensingItemWithHerb[];
  formula: Pick<HerbFormula, 'id' | 'name_pinyin' | 'name_english' | 'name_hebrew'> | null;
}

export interface DashboardLayoutRow {
  id: string;
  clinic_id: string;
  user_id: string;
  name: string;
  layout: unknown;
  created_at: string;
  updated_at: string;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partially_paid' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type PaymentMethod = 'card' | 'cash' | 'bank_transfer' | 'bit' | 'other';

export interface ClinicPaymentSettings {
  id: string;
  clinic_id: string;
  provider: 'grow';
  environment: 'sandbox' | 'production';
  grow_user_id: string | null;
  grow_page_code: string | null;
  grow_api_key: string | null;
  issue_invoice_via_provider: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  clinic_id: string;
  patient_id: string;
  encounter_id: string | null;
  appointment_id: string | null;
  invoice_number: number;
  status: InvoiceStatus;
  currency: string;
  subtotal: number;
  total: number;
  amount_paid: number;
  issued_at: string | null;
  due_date: string | null;
  notes: string | null;
  payment_url: string | null;
  provider_invoice_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  clinic_id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  source_table: string | null;
  source_id: string | null;
  sequence: number;
}

export interface Payment {
  id: string;
  clinic_id: string;
  invoice_id: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  provider: 'grow' | 'manual';
  provider_process_id: string | null;
  provider_process_token: string | null;
  provider_transaction_id: string | null;
  paid_at: string | null;
  raw_response: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceWithDetails extends Invoice {
  items: InvoiceItem[];
  payments: Payment[];
  patient: Pick<Patient, 'id' | 'full_name' | 'phone' | 'email'> | null;
}

export interface PatientPortalAccess {
  id: string;
  clinic_id: string;
  patient_id: string;
  user_id: string | null;
  email: string;
  invited_at: string;
  activated_at: string | null;
  is_active: boolean;
}
