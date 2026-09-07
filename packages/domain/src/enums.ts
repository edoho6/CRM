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

/**
 * Where on the body a point was needled, as the treatment note groups them.
 *
 * One axis, not two: a prescription is written as "upper, lower, left, right,
 * centre", and asking for a level *and* a side would make the practitioner
 * answer the same question twice. The catalogue suggests the bucket; the
 * practitioner has the last word.
 */
export const POINT_REGIONS = ['upper', 'lower', 'left', 'right', 'center'] as const;
export type PointRegion = (typeof POINT_REGIONS)[number];

/**
 * Where a point was actually needled, as the treatment note records it.
 *
 * Side and level together, because that is how needling is remembered and said
 * out loud: "LI4 right, ST36 both below". Splitting them into two questions
 * meant answering the same thing twice and, worse, meant the body chart could
 * only ever draw a point on both sides.
 *
 * Laid out on screen as a cross, with each quadrant where it belongs, so the
 * shape of the prescription is visible before a word of it is read. Ear sits by
 * the centre: auricular points have no upper or lower, and putting them in one
 * of the quadrants would be a lie for the sake of a tidy grid.
 */
export const POINT_PLACEMENTS = [
  'right_upper',
  'left_upper',
  'center',
  'ear',
  'right_lower',
  'left_lower',
] as const;
export type PointPlacement = (typeof POINT_PLACEMENTS)[number];

/**
 * Notes written before placements existed used one of five flat buckets. They
 * still have to open, so the old value is read and translated to the nearest
 * new one. Side is preserved where it was recorded; where it was not, the
 * right-hand quadrant is chosen so the point lands somewhere the practitioner
 * can see and move, rather than vanishing.
 */
const LEGACY_REGION_TO_PLACEMENT: Record<string, PointPlacement> = {
  upper: 'right_upper',
  lower: 'right_lower',
  left: 'left_upper',
  right: 'right_upper',
  center: 'center',
};

export function toPointPlacement(value: unknown): PointPlacement {
  if (typeof value !== 'string') return 'right_upper';
  if ((POINT_PLACEMENTS as readonly string[]).includes(value)) return value as PointPlacement;
  return LEGACY_REGION_TO_PLACEMENT[value] ?? 'right_upper';
}

/** Which side of the body a placement is on, or null when it has no side. */
export function placementSide(placement: PointPlacement): 'left' | 'right' | null {
  if (placement === 'left_upper' || placement === 'left_lower') return 'left';
  if (placement === 'right_upper' || placement === 'right_lower') return 'right';
  return null;
}

/**
 * How a herb is kept and dispensed.
 *
 * The unit follows from the preparation rather than being a separate choice: a
 * tincture is millilitres and a powder is not, and letting the two be picked
 * independently only ever produces "100g of tincture".
 */
export const HERB_PREPARATIONS = ['dried_herb', 'powder', 'tincture'] as const;
export type HerbPreparation = (typeof HERB_PREPARATIONS)[number];

export function preparationUnit(preparation: HerbPreparation | null | undefined): 'gram' | 'milliliter' {
  return preparation === 'tincture' ? 'milliliter' : 'gram';
}

/**
 * The status of a patient file — one question, not two.
 *
 * This began as a second field beside `is_active`, and having both meant
 * answering the same thing twice and being able to answer it inconsistently: a
 * file could be marked active and "stopped partway" at once. So `is_active` is
 * now derived from this, by a trigger in the database rather than by whichever
 * code path happened to write last. Only the first value counts as active.
 *
 * The distinctions past "not active" are the point: someone who stopped coming
 * and someone who finished and got better are both inactive, and a year later
 * that difference is the only part worth having.
 */
export const TREATMENT_STATUSES = [
  'active',
  'inactive',
  'completed',
  'dropped_out',
  'full_success',
  'partial_success',
  'unsuccessful',
] as const;
export type TreatmentStatus = (typeof TREATMENT_STATUSES)[number];

/** Whether a status means the file belongs in the working list. */
export function isActiveStatus(status: TreatmentStatus | null | undefined): boolean {
  return status === 'active' || status === undefined || status === null;
}

/** The fourteen channels the point catalogue is organised by. */
export const POINT_CHANNELS = [
  'lung',
  'large_intestine',
  'stomach',
  'spleen',
  'heart',
  'small_intestine',
  'bladder',
  'kidney',
  'pericardium',
  'san_jiao',
  'gallbladder',
  'liver',
  'ren',
  'du',
  'extra',
] as const;
export type PointChannel = (typeof POINT_CHANNELS)[number];

/** Which of the two body drawings a point is shown on. */
export const BODY_VIEWS = ['front', 'back'] as const;
export type BodyView = (typeof BODY_VIEWS)[number];

/**
 * Where on the body a point actually is.
 *
 * Distinct from `POINT_REGIONS`, which is the bucket a treatment note files a
 * point under. "Upper" covers the scalp, the ear, the shoulder and a fingertip
 * alike, which is fine for writing a prescription and useless for looking a
 * point up. This is the one a practitioner searches by. Ordered head to foot,
 * so a filter bar reads like a body rather than an alphabet.
 */
export const POINT_BODY_AREAS = [
  'head',
  'face',
  'ear',
  'neck',
  'shoulder',
  'chest',
  'abdomen',
  'upper_back',
  'lower_back',
  'sacrum',
  'buttock',
  'hip',
  'upper_arm',
  'elbow',
  'forearm',
  'wrist',
  'hand',
  'thigh',
  'knee',
  'lower_leg',
  'ankle',
  'foot',
] as const;
export type PointBodyArea = (typeof POINT_BODY_AREAS)[number];

/** Where a line on the order list stands. */
export const ORDER_LIST_STATUSES = ['pending', 'ordered', 'received'] as const;
export type OrderListStatus = (typeof ORDER_LIST_STATUSES)[number];

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

/* ---------------------------------------------------------------------------
 * Materia medica vocabulary
 * ---------------------------------------------------------------------------
 * These follow the standard textbook groupings (Bensky, Chinese Herbal
 * Medicine: Materia Medica), which is how practitioners were taught to think
 * about herbs and therefore how they expect to filter a catalogue.
 */

export const TCM_CATEGORIES = [
  'release_exterior_warm',
  'release_exterior_cool',
  'clear_heat_drain_fire',
  'clear_heat_cool_blood',
  'clear_heat_dry_dampness',
  'clear_heat_relieve_toxicity',
  'clear_deficient_heat',
  'clear_summer_heat',
  'downward_draining',
  'moist_laxative',
  'harsh_expellant',
  'drain_dampness',
  'dispel_wind_dampness',
  'aromatic_transform_dampness',
  'transform_phlegm_cold',
  'transform_phlegm_heat',
  'relieve_cough_wheezing',
  'relieve_food_stagnation',
  'regulate_qi',
  'stop_bleeding',
  'invigorate_blood',
  'warm_interior',
  'tonify_qi',
  'tonify_blood',
  'tonify_yang',
  'tonify_yin',
  'stabilize_bind',
  'calm_spirit_anchor',
  'calm_spirit_nourish',
  'aromatic_open_orifices',
  'extinguish_wind',
  'expel_parasites',
  'external_application',
  'other',
] as const;
export type TcmCategory = (typeof TCM_CATEGORIES)[number];

export const TEMPERATURES = [
  'hot',
  'warm',
  'slightly_warm',
  'neutral',
  'cool',
  'slightly_cold',
  'cold',
  'very_cold',
] as const;
export type Temperature = (typeof TEMPERATURES)[number];

export const TASTES = [
  'sweet',
  'bitter',
  'acrid',
  'sour',
  'salty',
  'bland',
  'astringent',
  'aromatic',
] as const;
export type Taste = (typeof TASTES)[number];

export const CHANNELS = [
  'lung',
  'large_intestine',
  'stomach',
  'spleen',
  'heart',
  'small_intestine',
  'bladder',
  'kidney',
  'pericardium',
  'san_jiao',
  'gallbladder',
  'liver',
] as const;
export type Channel = (typeof CHANNELS)[number];

export const FORMULA_TCM_CATEGORIES = [
  'release_exterior',
  'clear_heat',
  'purge',
  'harmonize',
  'treat_dryness',
  'expel_dampness',
  'warm_interior',
  'tonify',
  'regulate_qi',
  'invigorate_blood',
  'stop_bleeding',
  'stabilize_bind',
  'calm_spirit',
  'open_orifices',
  'extinguish_wind',
  'treat_phlegm',
  'reduce_food_stagnation',
  'expel_parasites',
  'other',
] as const;
export type FormulaTcmCategory = (typeof FORMULA_TCM_CATEGORIES)[number];

/**
 * The classical categories a point belongs to.
 *
 * Not decoration: "which is the xi-cleft point of this channel" and "show me
 * the back-shu points" are questions asked during a treatment, and a catalogue
 * that cannot answer them is a list of names. A point can hold several.
 *
 * Ordered as they are taught — the five transport points distal to proximal
 * first, then the connecting set, then the rest.
 */
export const POINT_CATEGORIES = [
  'jing_well',
  'ying_spring',
  'shu_stream',
  'jing_river',
  'he_sea',
  'yuan_source',
  'luo_connecting',
  'xi_cleft',
  'back_shu',
  'front_mu',
  'influential',
  'confluent',
  'command',
  'lower_he_sea',
  'window_of_sky',
  'sea_point',
  'ghost_point',
  'group_luo',
  'crossing',
  'entry',
  'exit',
] as const;
export type PointCategory = (typeof POINT_CATEGORIES)[number];

/* ---------------------------------------------------------------------------
 * Consent
 * ---------------------------------------------------------------------------
 * Marketing is its own kind from the outset. Bundling it with terms of use is
 * what makes a consent unfree, and separating it later means going back to
 * every patient to collect it again.
 */

export const CONSENT_KINDS = ['terms', 'privacy', 'treatment', 'marketing'] as const;
export type ConsentKind = (typeof CONSENT_KINDS)[number];

/** How a decision reached the clinic. A signature and a click are not the same evidence. */
export const CONSENT_METHODS = ['in_person', 'portal', 'paper_form', 'phone', 'email'] as const;
export type ConsentMethod = (typeof CONSENT_METHODS)[number];
