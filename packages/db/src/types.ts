import type {
  AppointmentStatus,
  ConfirmationResponse,
  RemindChannel,
  TagColor,
  AuditAction,
  BodyView,
  Channel,
  ConsentKind,
  ConsentMethod,
  FormulaTcmCategory,
  DispensingStatus,
  DocumentCategory,
  DoseTiming,
  FormField,
  EncounterStatus,
  FormulaCategory,
  HerbCategory,
  HerbPreparation,
  HerbUnit,
  Locale,
  MembershipRole,
  NeedleTechnique,
  OrderListStatus,
  PointBodyArea,
  PointCategory,
  PointChannel,
  PointPlacement,
  PointRegion,
  PointSide,
  PurchaseOrderStatus,
  Sex,
  StockMovementType,
  Taste,
  TcmCategory,
  Temperature,
  TreatmentModality,
  TreatmentStatus,
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
  /** False for a clinic that prescribes without holding stock. */
  tracks_inventory: boolean;
  /**
   * Marks a sandbox clinic holding fictional patients. Required before
   * `seed_synthetic_data()` will write anything, and shown as a banner on every
   * screen so a development database can never be mistaken for the real one.
   */
  is_synthetic: boolean;
  /** The reminder wording, with {name} {date} {time} {clinic} {link}. Null uses the built-in text. */
  reminder_template: string | null;
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
  /** The practitioner's own ID number, printed on a treatment confirmation. */
  national_id: string | null;
  /** Theirs, not the clinic's — a room rented two days a week is not the practice. */
  email: string | null;
  address: string | null;
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
  /** On the short list that runs the service; sees the overview of every clinic. */
  isPlatformAdmin: boolean;
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
  /**
   * How the course of treatment stands or ended. Separate from is_active, which
   * only decides whether the file appears in the working list.
   */
  treatment_status: TreatmentStatus;
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
  /** The treatment it was taken at, for a tongue photograph. Null for an ordinary file. */
  encounter_id: string | null;
  created_at: string;
}

export interface AppointmentType {
  id: string;
  clinic_id: string;
  name_he: string;
  name_en: string;
  default_duration_minutes: number;
  /** What this treatment normally costs. Null means it is not priced. */
  price: number | null;
  color: string;
  notes: string | null;
  /** Null for a type the whole clinic shares. */
  practitioner_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
  /** Which room, when the clinic has any. The room, not the practitioner, is what cannot be double-booked. */
  room_id: string | null;
  /** When the reminder went out, by whatever channel. Null: not yet. */
  reminder_sent_at: string | null;
  /** The secret in the reminder link. Never rendered to anyone but the patient. */
  confirmation_token: string;
  /** What the patient tapped. Null until they answer. */
  confirmation_response: ConfirmationResponse | null;
  responded_at: string | null;
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
  room?: Pick<Room, 'id' | 'name' | 'color'> | null;
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
  /** When the record was opened — the time of day the filing date cannot carry. */
  started_at: string;
  status: EncounterStatus;
  signed_at: string | null;
  signed_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * A point recorded in `tcm_notes.points_used`.
 *
 * `point_id` is present only when the entry came from the catalogue; free text
 * is always allowed and simply does not appear on the body map. `side` survives
 * for notes written before regions replaced it, and `region` is read leniently
 * because notes written before placements existed carry one of the five old
 * flat buckets.
 */
export interface RecordedPoint {
  point: string;
  point_id?: string | null;
  region?: PointPlacement | PointRegion;
  side?: PointSide;
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
  pharmaceutical_name: string | null;
  tcm_category: TcmCategory | null;
  temperature: Temperature | null;
  tastes: Taste[];
  channels: Channel[];
  indications: string | null;
  dosage_min_g: number | null;
  dosage_max_g: number | null;
  dosage_notes: string | null;
  image_url: string | null;
  image_attribution: string | null;
  needs_review: boolean;
  data_source: string | null;
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

/**
 * One line of the shelf, from the `herb_stock_by_preparation` view.
 *
 * A herb kept as dried root and as tincture has two rows here and one row in
 * `HerbStockLevel`. Both are wanted: the total answers "do we stock this", and
 * these answer "what is actually on the shelf", which is the question asked
 * while writing a prescription.
 */
export interface HerbStockByPreparation {
  clinic_id: string;
  herb_id: string;
  preparation: HerbPreparation;
  unit: 'gram' | 'milliliter';
  total_remaining: number | null;
  batch_count: number;
  nearest_expiry: string | null;
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
  tcm_category: TcmCategory | null;
  image_url: string | null;
  needs_review: boolean;
  category: HerbCategory;
  default_unit: HerbUnit;
  reorder_threshold: number | null;
  reorder_quantity: number | null;
  is_active: boolean;
  total_remaining: number;
  batch_count: number;
  /** Every batch ever received, including emptied ones. */
  batch_count_total: number;
  nearest_expiry: string | null;
  is_below_threshold: boolean;
  /** Received at least once, or given a reorder threshold: this herb lives in the stock room. */
  is_stocked: boolean;
}

/**
 * A formula's stock position, from the `formula_stock_levels` view.
 *
 * A formula holds nothing itself; what it has is a ceiling set by its scarcest
 * ingredient, which is why the figure is doses rather than grams.
 */
export interface FormulaStockLevel {
  formula_id: string;
  clinic_id: string;
  name_pinyin: string | null;
  name_chinese: string | null;
  name_english: string | null;
  name_hebrew: string | null;
  tcm_category: FormulaTcmCategory | null;
  category: FormulaCategory;
  needs_review: boolean;
  is_active: boolean;
  reorder_threshold_doses: number | null;
  item_count: number;
  /** Ingredients with nothing left — the reason the formula cannot be made. */
  missing_count: number;
  doses_available: number;
  any_ingredient_stocked: boolean;
  is_below_threshold: boolean;
  is_stocked: boolean;
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
  tcm_category: FormulaTcmCategory | null;
  source_text: string | null;
  actions: string | null;
  contraindications: string | null;
  modifications: string | null;
  dosage_notes: string | null;
  /** Low-stock threshold in whole doses, since a formula has no batches. */
  reorder_threshold_doses: number | null;
  image_url: string | null;
  needs_review: boolean;
  data_source: string | null;
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
  herb: Pick<
    Herb,
    'id' | 'pinyin_name' | 'chinese_name' | 'english_name' | 'hebrew_name' | 'default_unit'
  > | null;
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
  preparation: HerbPreparation;
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
  /** The preparation the whole prescription was written in, when one applies. */
  preparation: HerbPreparation | null;
  /** Free text: practitioners write "10 days", "שבועיים ואז נראה". */
  days_supply: string | null;
  /** How much the patient takes at a time — not how much was dispensed. */
  dose_amount: number | null;
  dose_unit: HerbUnit | null;
  dose_timing: DoseTiming | null;
  /** How many times a day. Bounded at twelve by the database. */
  doses_per_day: number | null;
  total_cost: number | null;
  created_at: string;
}

export interface DispensingItem {
  id: string;
  clinic_id: string;
  dispensing_record_id: string;
  /** Null for a line the catalogue has never heard of; custom_name carries it. */
  herb_id: string | null;
  custom_name: string | null;
  batch_id: string | null;
  quantity: number;
  unit: HerbUnit;
  preparation: HerbPreparation | null;
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

/**
 * A point in the acupuncture catalogue.
 *
 * `x`/`y` are schematic coordinates on the body diagram (200 wide, 520 tall,
 * midline at 100); a bilateral point is mirrored by the renderer. They exist to
 * show which points a treatment used, not to locate one on a patient.
 *
 * The clinical text fields ship empty and are filled in by hand later, which is
 * what `needs_review` tracks.
 */
export interface AcupuncturePoint {
  id: string;
  clinic_id: string;
  code: string;
  channel: PointChannel;
  point_number: number | null;
  pinyin_name: string | null;
  chinese_name: string | null;
  english_name: string | null;
  hebrew_name: string | null;
  body_view: BodyView;
  x: number | null;
  y: number | null;
  bilateral: boolean;
  default_region: PointRegion;
  /** Anatomical region, for looking a point up by body part. */
  body_area: PointBodyArea | null;
  location: string | null;
  actions: string | null;
  indications: string | null;
  needling: string | null;
  cautions: string | null;
  /** Classical categories: five-shu, yuan-source, back-shu, front-mu and the rest. */
  point_categories: PointCategory[];
  needs_review: boolean;
  data_source: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** One line on the order list. Exactly one of herb_id / formula_id is set. */
export interface OrderListEntry {
  id: string;
  clinic_id: string;
  herb_id: string | null;
  formula_id: string | null;
  quantity: number | null;
  unit: HerbUnit | 'dose';
  /** Ordering dried root and powder of one herb are two separate lines. */
  preparation: HerbPreparation | null;
  supplier_id: string | null;
  status: OrderListStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderListEntryWithTarget extends OrderListEntry {
  herb: Pick<
    Herb,
    'id' | 'pinyin_name' | 'chinese_name' | 'english_name' | 'hebrew_name' | 'default_unit'
  > | null;
  formula: Pick<
    HerbFormula,
    'id' | 'name_pinyin' | 'name_chinese' | 'name_english' | 'name_hebrew'
  > | null;
  supplier: Pick<Supplier, 'id' | 'name'> | null;
}

/**
 * A versioned consent text.
 *
 * Once `published_at` is set the body is frozen by a database trigger: editing
 * the text a patient agreed to would make every consent citing it a lie.
 */
export interface ConsentDocument {
  id: string;
  clinic_id: string;
  kind: ConsentKind;
  version: number;
  locale: Locale;
  title: string;
  body: string;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * One consent decision, append-only.
 *
 * Withdrawing is a new row with `granted = false`, never an update — "she
 * consented in March and withdrew in September" is the fact worth keeping.
 */
export interface PatientConsent {
  id: string;
  clinic_id: string;
  patient_id: string;
  document_id: string | null;
  kind: ConsentKind;
  granted: boolean;
  method: ConsentMethod;
  decided_at: string;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface PatientConsentWithDocument extends PatientConsent {
  document: Pick<ConsentDocument, 'kind' | 'version' | 'locale' | 'title' | 'published_at'> | null;
}

/** The standing answer per patient and kind, from `patient_consent_status`. */
export interface PatientConsentStatus {
  patient_id: string;
  clinic_id: string;
  kind: ConsentKind;
  granted: boolean;
  decided_at: string;
  method: ConsentMethod;
  document_id: string | null;
  document_version: number | null;
  document_title: string | null;
}

/**
 * Whether a treatment has been billed and paid, from
 * `encounter_payment_status`. One view so the treatment list, the patient's file
 * and the treatment itself all answer the question the same way.
 */
export interface EncounterPaymentStatus {
  encounter_id: string;
  clinic_id: string;
  patient_id: string;
  appointment_id: string | null;
  invoice_id: string | null;
  invoice_number: number | null;
  invoice_status: InvoiceStatus | null;
  total: number | null;
  amount_paid: number | null;
  payment_url: string | null;
  payment_state: 'unbilled' | 'unpaid' | 'partially_paid' | 'paid' | 'cancelled';
}

/** The same question for a booking, from `appointment_payment_status`. */
export interface AppointmentPaymentStatus {
  appointment_id: string;
  clinic_id: string;
  patient_id: string;
  invoice_id: string | null;
  invoice_number: number | null;
  invoice_status: InvoiceStatus | null;
  total: number | null;
  amount_paid: number | null;
  payment_url: string | null;
  payment_state: 'unbilled' | 'unpaid' | 'partially_paid' | 'paid' | 'cancelled';
}

/** A questionnaire the practitioner built. Questions live in `fields`. */
export interface FormTemplate {
  id: string;
  clinic_id: string;
  title: string;
  description: string | null;
  fields: FormField[];
  /** Bumped when the questions change, and copied onto every submission. */
  version: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * One filled-in form.
 *
 * Carries its own copy of the questions as asked. Editing the template later
 * cannot change what someone appears to have answered.
 */
export interface FormSubmission {
  id: string;
  clinic_id: string;
  template_id: string;
  patient_id: string;
  encounter_id: string | null;
  template_version: number;
  fields: FormField[];
  answers: Record<string, unknown>;
  submitted_at: string;
  submitted_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface FormSubmissionWithTemplate extends FormSubmission {
  template: Pick<FormTemplate, 'id' | 'title'> | null;
  patient: Pick<Patient, 'id' | 'full_name'> | null;
}

/**
 * One signature, against a consent decision or a filled-in form.
 *
 * `typed` is the accessible route rather than a lesser one: drawing with a
 * finger is impossible for some people, so confirming by typing your own name is
 * offered as an equal option. Which was used is recorded because they are
 * different evidence.
 */
export interface Signature {
  id: string;
  clinic_id: string;
  patient_id: string;
  /** Exactly one of these is set. */
  consent_id: string | null;
  form_submission_id: string | null;
  method: 'drawn' | 'typed';
  /** A PNG data URL for `drawn`, the typed name for `typed`. */
  content: string;
  signed_at: string;
  witnessed_by: string | null;
  created_at: string;
}

/** A punch card: sessions bought up front and drawn down one visit at a time. */
export interface PatientPackage {
  id: string;
  clinic_id: string;
  patient_id: string;
  name: string;
  total_sessions: number;
  price: number | null;
  purchased_on: string;
  /** Null means it does not expire, which is the common case. */
  expires_on: string | null;
  invoice_id: string | null;
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** One session drawn off a card. The treatment link is optional — see the migration. */
export interface PackageRedemption {
  id: string;
  clinic_id: string;
  package_id: string;
  encounter_id: string | null;
  redeemed_on: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

/** A card with its sessions counted, from the `package_balances` view. */
export interface PackageBalance {
  package_id: string;
  clinic_id: string;
  patient_id: string;
  name: string;
  total_sessions: number;
  price: number | null;
  purchased_on: string;
  expires_on: string | null;
  is_active: boolean;
  used_sessions: number;
  remaining_sessions: number;
  last_redeemed_on: string | null;
  is_expired: boolean;
}

/**
 * A practitioner's attestation that they treated a patient on given dates.
 *
 * Every printed detail is stored rather than re-derived. A confirmation is a
 * statement made on a day, and it has to keep saying what it said even after a
 * record is corrected — and it may include dates typed by hand, for treatment
 * given before this system existed.
 */
export interface TreatmentConfirmation {
  id: string;
  clinic_id: string;
  patient_id: string;
  practitioner_id: string;
  treatment_dates: string[];
  practitioner_name: string;
  practitioner_national_id: string | null;
  practitioner_title: string | null;
  practitioner_license: string | null;
  patient_name: string;
  patient_national_id: string | null;
  purpose: string | null;
  notes: string | null;
  issued_at: string;
  issued_by: string | null;
  created_at: string;
}

/** One herb in a protocol's prescription. */
export interface ProtocolHerb {
  herb_id: string | null;
  /** Kept beside the id so the protocol still reads if the herb is retired. */
  name: string;
  quantity: number | null;
  preparation: string | null;
}

/**
 * A reusable point combination and prescription.
 *
 * Applying one fills a treatment in and leaves it editable. Nothing links a
 * treatment back to the protocol it started from — the record says what was
 * done, not what was intended.
 */
export interface TreatmentProtocol {
  id: string;
  clinic_id: string;
  name: string;
  description: string | null;
  indications: string | null;
  treatment_principle: string | null;
  points_used: RecordedPoint[];
  formula_id: string | null;
  herbs: ProtocolHerb[];
  preparation: string | null;
  days_supply: string | null;
  dose_amount: number | null;
  dose_unit: string | null;
  dose_timing: string | null;
  doses_per_day: number | null;
  is_active: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * One item on the practitioner's to-do list.
 *
 * Deliberately small: what, by when, whether it is urgent, and optionally which
 * patient it concerns. Everything beyond that turns a list into a thing that
 * itself needs managing.
 */
export interface ClinicTask {
  id: string;
  clinic_id: string;
  title: string;
  notes: string | null;
  /** Null is a real answer — a task with an invented date nags on a day nobody chose. */
  due_on: string | null;
  is_urgent: boolean;
  /** Null is the whole of "still to do". */
  done_at: string | null;
  patient_id: string | null;
  /** The instant the alert fires, when the task has one. */
  due_at: string | null;
  remind_via: RemindChannel;
  /** Set once the alert has fired, so it fires once. */
  reminded_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClinicTaskWithPatient extends ClinicTask {
  patient: Pick<Patient, 'id' | 'full_name'> | null;
}

/** A patient row from the `patients_with_diary` view: the file plus what the diary knows. */
export interface PatientWithDiary extends Patient {
  next_appointment_at: string | null;
  last_appointment_at: string | null;
}

/** A treatment room or branch. Bookings in it cannot overlap. */
export interface Room {
  id: string;
  clinic_id: string;
  name: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** One practitioner's private iCalendar subscription. The token is the whole secret. */
export interface CalendarFeed {
  id: string;
  clinic_id: string;
  practitioner_id: string;
  token: string;
  created_at: string;
  last_fetched_at: string | null;
}

/** A free label the clinic puts on patient files. */
export interface PatientTag {
  id: string;
  clinic_id: string;
  name: string;
  color: TagColor;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PatientTagLink {
  id: string;
  clinic_id: string;
  patient_id: string;
  tag_id: string;
  created_by: string | null;
  created_at: string;
}
